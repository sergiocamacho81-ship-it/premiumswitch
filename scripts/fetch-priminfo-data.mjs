import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const UA = "PremiumSwitch-data-fetch/1.0 (+https://github.com/)";

const CKAN_PACKAGE_URL =
  "https://opendata.swiss/api/3/action/package_show?id=health-insurance-premiums";
const INSURER_REGISTRY_PAGE =
  "https://www.bag.admin.ch/de/verzeichnisse-der-zugelassenen-kranken-und-rueckversicherer";
const PREMIUM_REGIONS_URL =
  "https://www.priminfo.admin.ch/downloads/praemienregionen.xlsx";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function parseDelimited(text, delimiter) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(delimiter);
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    const row = {};
    header.forEach((key, i) => (row[key] = cells[i]));
    return row;
  });
}

async function getCkanResourceUrl(resourceName) {
  const res = await fetch(CKAN_PACKAGE_URL, { headers: { "User-Agent": UA } });
  const pkg = await res.json();
  const resource = pkg.result.resources.find(
    (r) => r.name?.en === resourceName
  );
  if (!resource) throw new Error(`CKAN resource not found: ${resourceName}`);
  return resource.url;
}

async function buildPremiums() {
  const url = await getCkanResourceUrl("Prämien_CH.csv");
  console.log("Downloading premiums:", url);
  const csv = await fetchText(url);
  const rows = parseDelimited(csv, ",");

  const premiums = {};
  const deductiblesByAgeClass = { KIN: new Set(), JUG: new Set(), ERW: new Set() };
  let kept = 0;
  for (const row of rows) {
    if (row.Tariftyp !== "TAR-BASE") continue;
    const kanton = row.Kanton;
    const region = row.Region.replace("PR-REG CH", "");
    const altersklasse = row.Altersklasse.replace("AKL-", "");
    const unfall = row.Unfalleinschluss.replace("-UNF", "");
    const franchise = Number(row.Franchise.replace("FRA-", ""));
    const insurer = row.Versicherer;
    const premium = Number(row.Prämie);

    premiums[kanton] ??= {};
    premiums[kanton][region] ??= {};
    premiums[kanton][region][altersklasse] ??= {};
    premiums[kanton][region][altersklasse][unfall] ??= {};
    premiums[kanton][region][altersklasse][unfall][franchise] ??= {};
    premiums[kanton][region][altersklasse][unfall][franchise][insurer] =
      premium;
    deductiblesByAgeClass[altersklasse].add(franchise);
    kept++;
  }
  console.log(`Premiums: kept ${kept} of ${rows.length} rows (TAR-BASE only)`);
  return {
    premiums,
    deductiblesByAgeClass: {
      KIN: [...deductiblesByAgeClass.KIN].sort((a, b) => a - b),
      JUG: [...deductiblesByAgeClass.JUG].sort((a, b) => a - b),
      ERW: [...deductiblesByAgeClass.ERW].sort((a, b) => a - b),
    },
  };
}

async function buildMarketShare() {
  const url = await getCkanResourceUrl("Versichertenbestand_CH.csv");
  console.log("Downloading market share:", url);
  const csv = await fetchText(url);
  const rows = parseDelimited(csv, ";");

  const latestYear = Math.max(...rows.map((r) => Number(r.Geschäftsjahr)));
  const marketShare = {};
  for (const row of rows) {
    if (Number(row.Geschäftsjahr) !== latestYear) continue;
    const kanton = row.Kanton;
    const insurer = row.Versicherer.replace(/^0+/, "");
    marketShare[kanton] ??= {};
    marketShare[kanton][insurer] = Number(row.Durchschnittsbestand);
  }
  console.log(`Market share: year ${latestYear}, ${Object.keys(marketShare).length} cantons`);
  return { latestYear, marketShare };
}

async function buildInsurers() {
  console.log("Fetching insurer registry page:", INSURER_REGISTRY_PAGE);
  const html = await fetchText(INSURER_REGISTRY_PAGE);
  const match = html.match(
    /<a[^>]*aria-label="Download Verzeichnis der zugelassenen Krankenversicherer[^"]*"[^>]*href="([^"]+\.xlsx)"/
  );
  if (!match) throw new Error("Could not locate insurer registry xlsx link");
  const xlsxUrl = match[1];
  console.log("Downloading insurer registry:", xlsxUrl);
  const buffer = await fetchBuffer(xlsxUrl);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames.find((n) => n.trim().startsWith("Index"));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    raw: false,
  });

  const insurers = {};
  for (const row of rows) {
    const code = row?.[0];
    const name = row?.[2];
    const place = row?.[3];
    if (code && /^\d+$/.test(String(code).trim())) {
      insurers[String(Number(code))] = { name: name.trim(), place: place.trim() };
    }
  }
  console.log(`Insurers: ${Object.keys(insurers).length} entries`);
  return insurers;
}

async function buildRegions() {
  console.log("Downloading premium regions:", PREMIUM_REGIONS_URL);
  const buffer = await fetchBuffer(PREMIUM_REGIONS_URL);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["B_NPA"], {
    header: 1,
    raw: false,
  });

  const byPlz = new Map();
  for (const row of rows) {
    const plz = row?.[1];
    if (!plz || !/^\d{4}$/.test(plz)) continue;
    const [, , ort, kanton, region, , gemeinde] = row;
    if (!byPlz.has(plz)) byPlz.set(plz, []);
    byPlz.get(plz).push({ ort, kanton, region, gemeinde });
  }

  const regions = {};
  for (const [plz, entries] of byPlz) {
    const uniqueCombos = [
      ...new Map(entries.map((e) => [`${e.kanton}|${e.region}`, e])).values(),
    ];
    regions[plz] = {
      primary: uniqueCombos[0],
      ambiguous: uniqueCombos.length > 1,
      candidates: uniqueCombos.length > 1 ? uniqueCombos : undefined,
    };
  }
  console.log(`Regions: ${Object.keys(regions).length} postcodes`);
  return regions;
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const [premiumsResult, insurers, regions, marketShareResult] = await Promise.all([
    buildPremiums(),
    buildInsurers(),
    buildRegions(),
    buildMarketShare(),
  ]);
  const { premiums, deductiblesByAgeClass } = premiumsResult;

  const meta = {
    fetchedAt: new Date().toISOString(),
    premiumYear: 2026,
    marketShareYear: marketShareResult.latestYear,
    deductiblesByAgeClass,
    sources: {
      premiums: "https://opendata.swiss/en/dataset/health-insurance-premiums",
      insurerRegistry: INSURER_REGISTRY_PAGE,
      premiumRegions: PREMIUM_REGIONS_URL,
    },
  };

  await Promise.all([
    writeFile(
      path.join(DATA_DIR, "premiums.json"),
      JSON.stringify(premiums)
    ),
    writeFile(
      path.join(DATA_DIR, "insurers.json"),
      JSON.stringify(insurers, null, 2)
    ),
    writeFile(
      path.join(DATA_DIR, "regions.json"),
      JSON.stringify(regions)
    ),
    writeFile(
      path.join(DATA_DIR, "market-share.json"),
      JSON.stringify(marketShareResult.marketShare)
    ),
    writeFile(path.join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2)),
  ]);

  console.log("Done. Data written to", DATA_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
