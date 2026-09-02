import type { AppLocale } from "@/i18n/routing";

export type SwitchRequestInput = {
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD
  street: string;
  postcode: string;
  city: string;
  email: string;
  phone?: string;
  currentInsurerName: string;
  policyNumber?: string;
  newInsurerName: string;
  premium: number;
  deductible: number;
};

export type SwitchRequestErrorCode =
  | "required"
  | "maxLength"
  | "invalidDate"
  | "invalidEmail"
  | "invalidSwissPostcode"
  | "missingPremium"
  | "invalidDeductible";

export type SwitchRequestError = {
  field: string;
  code: SwitchRequestErrorCode;
  params?: Record<string, string>;
};

const REQUIRED_FIELDS: Array<keyof SwitchRequestInput> = [
  "firstName",
  "lastName",
  "birthDate",
  "street",
  "postcode",
  "city",
  "email",
  "currentInsurerName",
  "newInsurerName",
];

// Generous caps that no legitimate value could hit — purely to stop a
// malicious or malformed request from writing megabyte-sized strings into
// storage (or into the generated letters).
const MAX_LENGTHS: Partial<Record<keyof SwitchRequestInput, number>> = {
  firstName: 100,
  lastName: 100,
  street: 200,
  city: 100,
  email: 200,
  phone: 30,
  currentInsurerName: 150,
  policyNumber: 50,
  newInsurerName: 150,
};

export function validateSwitchRequest(
  input: Partial<SwitchRequestInput>
): SwitchRequestError[] {
  const errors: SwitchRequestError[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!input[field] || String(input[field]).trim() === "") {
      errors.push({ field, code: "required" });
    }
  }

  for (const [field, maxLength] of Object.entries(MAX_LENGTHS) as Array<
    [keyof SwitchRequestInput, number]
  >) {
    const value = input[field];
    if (typeof value === "string" && value.length > maxLength) {
      errors.push({ field, code: "maxLength", params: { max: String(maxLength) } });
    }
  }

  if (input.birthDate && Number.isNaN(Date.parse(input.birthDate))) {
    errors.push({ field: "birthDate", code: "invalidDate" });
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({ field: "email", code: "invalidEmail" });
  }

  if (input.postcode && !/^[1-9]\d{3}$/.test(input.postcode)) {
    errors.push({ field: "postcode", code: "invalidSwissPostcode" });
  }

  if (
    input.premium == null ||
    Number.isNaN(input.premium) ||
    input.premium <= 0 ||
    input.premium > 5000
  ) {
    errors.push({ field: "premium", code: "missingPremium" });
  }

  if (
    input.deductible != null &&
    (Number.isNaN(input.deductible) || input.deductible < 0 || input.deductible > 2500)
  ) {
    errors.push({ field: "deductible", code: "invalidDeductible" });
  }

  return errors;
}

export function getSwitchDates(now = new Date()) {
  const year = now.getUTCFullYear();
  const nov30ThisYearUTC = Date.UTC(year, 10, 30);
  const targetYear = now.getTime() <= nov30ThisYearUTC ? year : year + 1;
  return {
    cancellationDeadline: new Date(Date.UTC(targetYear, 10, 30)),
    effectiveDate: new Date(Date.UTC(targetYear + 1, 0, 1)),
  };
}

const DATE_LOCALE: Record<AppLocale, string> = {
  de: "de-CH",
  fr: "fr-CH",
  it: "it-CH",
  en: "en-GB",
};

function formatDate(date: Date, locale: AppLocale): string {
  return date.toLocaleDateString(DATE_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

type LetterFn = (input: SwitchRequestInput, now: Date) => string;

const CANCELLATION_LETTERS: Record<AppLocale, LetterFn> = {
  de: (input, now) => {
    const { cancellationDeadline } = getSwitchDates(now);
    const fullName = `${input.firstName} ${input.lastName}`;
    return `${fullName}
${input.street}
${input.postcode} ${input.city}

${input.currentInsurerName}
[Adresse des Versicherers — bitte anhand der Policenunterlagen prüfen]

${input.city}, ${formatDate(now, "de")}

Betreff: Ordentliche Kündigung der obligatorischen Krankenpflegeversicherung (KVG)

Sehr geehrte Damen und Herren

Hiermit kündige ich meine obligatorische Krankenpflegeversicherung (KVG)${input.policyNumber ? `, Policennummer ${input.policyNumber},` : ""} ordentlich per 31. Dezember ${cancellationDeadline.getUTCFullYear()} gemäss Art. 7 KVG.

Angaben zur versicherten Person:
Name: ${fullName}
Geburtsdatum: ${input.birthDate}
Adresse: ${input.street}, ${input.postcode} ${input.city}

Ich bitte Sie, mir die Kündigung schriftlich zu bestätigen.

Freundliche Grüsse

${fullName}
(Unterschrift erforderlich bei postalischem Versand)

---
Erstellt von PremiumSwitch am ${formatDate(now, "de")}.`;
  },
  fr: (input, now) => {
    const { cancellationDeadline } = getSwitchDates(now);
    const fullName = `${input.firstName} ${input.lastName}`;
    return `${fullName}
${input.street}
${input.postcode} ${input.city}

${input.currentInsurerName}
[Adresse de l'assureur — merci de vérifier sur vos documents de police]

${input.city}, le ${formatDate(now, "fr")}

Concerne : Résiliation ordinaire de l'assurance obligatoire des soins (LAMal)

Madame, Monsieur,

Par la présente, je résilie mon assurance obligatoire des soins (LAMal)${input.policyNumber ? `, numéro de police ${input.policyNumber},` : ""} de manière ordinaire pour le 31 décembre ${cancellationDeadline.getUTCFullYear()}, conformément à l'art. 7 LAMal.

Coordonnées de l'assuré-e :
Nom : ${fullName}
Date de naissance : ${input.birthDate}
Adresse : ${input.street}, ${input.postcode} ${input.city}

Je vous prie de bien vouloir me confirmer cette résiliation par écrit.

Meilleures salutations,

${fullName}
(Signature requise en cas d'envoi postal)

---
Préparé par PremiumSwitch le ${formatDate(now, "fr")}.`;
  },
  it: (input, now) => {
    const { cancellationDeadline } = getSwitchDates(now);
    const fullName = `${input.firstName} ${input.lastName}`;
    return `${fullName}
${input.street}
${input.postcode} ${input.city}

${input.currentInsurerName}
[Indirizzo dell'assicuratore — verificare sui documenti di polizza]

${input.city}, ${formatDate(now, "it")}

Oggetto: Disdetta ordinaria dell'assicurazione obbligatoria delle cure medico-sanitarie (LAMal)

Gentili Signore e Signori,

Con la presente disdico la mia assicurazione obbligatoria delle cure medico-sanitarie (LAMal)${input.policyNumber ? `, numero di polizza ${input.policyNumber},` : ""} in via ordinaria per il 31 dicembre ${cancellationDeadline.getUTCFullYear()}, conformemente all'art. 7 LAMal.

Dati dell'assicurato/a:
Nome: ${fullName}
Data di nascita: ${input.birthDate}
Indirizzo: ${input.street}, ${input.postcode} ${input.city}

Vi prego di confermarmi la disdetta per iscritto.

Cordiali saluti,

${fullName}
(Firma richiesta in caso di invio postale)

---
Preparato da PremiumSwitch il ${formatDate(now, "it")}.`;
  },
  en: (input, now) => {
    const { cancellationDeadline } = getSwitchDates(now);
    const fullName = `${input.firstName} ${input.lastName}`;
    return `${fullName}
${input.street}
${input.postcode} ${input.city}

${input.currentInsurerName}
[Insurer mailing address — please verify against your policy documents]

${input.city}, ${formatDate(now, "en")}

Subject: Ordinary termination of compulsory health insurance (KVG/LAMal)

Dear Sir or Madam,

I hereby give notice of ordinary termination of my compulsory health insurance policy (KVG/LAMal)${input.policyNumber ? `, policy number ${input.policyNumber},` : ""} effective 31 December ${cancellationDeadline.getUTCFullYear()}, in accordance with Art. 7 KVG.

Policyholder details:
Name: ${fullName}
Date of birth: ${input.birthDate}
Address: ${input.street}, ${input.postcode} ${input.city}

Please confirm this termination in writing.

Yours faithfully,

${fullName}
(Signature required if sending by post)

---
Prepared by PremiumSwitch on ${formatDate(now, "en")}.`;
  },
};

const APPLICATION_SUMMARIES: Record<AppLocale, LetterFn> = {
  de: (input, now) => {
    const { effectiveDate } = getSwitchDates(now);
    const fullName = `${input.firstName} ${input.lastName}`;
    return `NEUER ANTRAG KRANKENVERSICHERUNG — ZUSAMMENFASSUNG
Erstellt von PremiumSwitch am ${formatDate(now, "de")}

Dies ist kein offizielles Formular des Versicherers. Diese Zusammenfassung dient dazu, den offiziellen Antrag beim neuen Versicherer auszufüllen — entweder durch PremiumSwitch im Auftrag der antragstellenden Person oder durch diese selbst.

Angaben zur antragstellenden Person:
Name: ${fullName}
Geburtsdatum: ${input.birthDate}
Adresse: ${input.street}, ${input.postcode} ${input.city}
E-Mail: ${input.email}
Telefon: ${input.phone || "—"}

Gewünschter neuer Versicherer: ${input.newInsurerName}
Modell: Standard (Grundversicherung)
Franchise: CHF ${input.deductible}
Unfalldeckung: Eingeschlossen
Geschätzte Monatsprämie: CHF ${input.premium}
Gewünschtes Startdatum: 1. Januar ${effectiveDate.getUTCFullYear()}

Wechsel von: ${input.currentInsurerName}`;
  },
  fr: (input, now) => {
    const { effectiveDate } = getSwitchDates(now);
    const fullName = `${input.firstName} ${input.lastName}`;
    return `NOUVELLE DEMANDE D'ASSURANCE-MALADIE — RÉSUMÉ
Préparé par PremiumSwitch le ${formatDate(now, "fr")}

Ceci n'est pas un formulaire officiel de l'assureur. Ce résumé sert à compléter la demande officielle auprès du nouvel assureur, soit par PremiumSwitch au nom du/de la demandeur/euse, soit directement par celui-ci/celle-ci.

Coordonnées du/de la demandeur/euse :
Nom : ${fullName}
Date de naissance : ${input.birthDate}
Adresse : ${input.street}, ${input.postcode} ${input.city}
E-mail : ${input.email}
Téléphone : ${input.phone || "—"}

Nouvel assureur souhaité : ${input.newInsurerName}
Modèle : Standard (assurance de base)
Franchise : CHF ${input.deductible}
Couverture accident : Incluse
Prime mensuelle estimée : CHF ${input.premium}
Date de début souhaitée : 1er janvier ${effectiveDate.getUTCFullYear()}

Changement depuis : ${input.currentInsurerName}`;
  },
  it: (input, now) => {
    const { effectiveDate } = getSwitchDates(now);
    const fullName = `${input.firstName} ${input.lastName}`;
    return `NUOVA RICHIESTA DI ASSICURAZIONE MALATTIA — RIEPILOGO
Preparato da PremiumSwitch il ${formatDate(now, "it")}

Questo non è un modulo ufficiale dell'assicuratore. Questo riepilogo serve a completare la richiesta ufficiale presso il nuovo assicuratore, da parte di PremiumSwitch per conto del richiedente oppure direttamente dal richiedente stesso.

Dati del richiedente:
Nome: ${fullName}
Data di nascita: ${input.birthDate}
Indirizzo: ${input.street}, ${input.postcode} ${input.city}
E-mail: ${input.email}
Telefono: ${input.phone || "—"}

Nuovo assicuratore richiesto: ${input.newInsurerName}
Modello: Standard (assicurazione di base)
Franchigia: CHF ${input.deductible}
Copertura infortuni: Inclusa
Premio mensile stimato: CHF ${input.premium}
Data di inizio richiesta: 1° gennaio ${effectiveDate.getUTCFullYear()}

Cambio da: ${input.currentInsurerName}`;
  },
  en: (input, now) => {
    const { effectiveDate } = getSwitchDates(now);
    const fullName = `${input.firstName} ${input.lastName}`;
    return `NEW HEALTH INSURANCE APPLICATION — REQUEST SUMMARY
Prepared by PremiumSwitch on ${formatDate(now, "en")}

This is not an official insurer form. It summarizes the details needed to
complete the new insurer's official application, either by PremiumSwitch on
the applicant's behalf or by the applicant directly.

Applicant details:
Name: ${fullName}
Date of birth: ${input.birthDate}
Address: ${input.street}, ${input.postcode} ${input.city}
Email: ${input.email}
Phone: ${input.phone || "—"}

Requested new insurer: ${input.newInsurerName}
Model: Standard (Grundversicherung)
Deductible: CHF ${input.deductible}
Accident coverage: Included
Estimated monthly premium: CHF ${input.premium}
Requested start date: 1 January ${effectiveDate.getUTCFullYear()}

Switching from: ${input.currentInsurerName}`;
  },
};

export function generateCancellationLetter(
  input: SwitchRequestInput,
  now = new Date(),
  locale: AppLocale = "de"
): string {
  return CANCELLATION_LETTERS[locale](input, now);
}

export function generateApplicationSummary(
  input: SwitchRequestInput,
  now = new Date(),
  locale: AppLocale = "de"
): string {
  return APPLICATION_SUMMARIES[locale](input, now);
}
