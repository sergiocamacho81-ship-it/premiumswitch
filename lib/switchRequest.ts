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

export type SwitchRequestError = { field: string; message: string };

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
      errors.push({ field, message: "This field is required." });
    }
  }

  for (const [field, maxLength] of Object.entries(MAX_LENGTHS) as Array<
    [keyof SwitchRequestInput, number]
  >) {
    const value = input[field];
    if (typeof value === "string" && value.length > maxLength) {
      errors.push({ field, message: `Must be ${maxLength} characters or fewer.` });
    }
  }

  if (input.birthDate && Number.isNaN(Date.parse(input.birthDate))) {
    errors.push({ field: "birthDate", message: "Enter a valid date." });
  }

  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({ field: "email", message: "Enter a valid email address." });
  }

  if (input.postcode && !/^[1-9]\d{3}$/.test(input.postcode)) {
    errors.push({
      field: "postcode",
      message: "Enter a valid Swiss postcode.",
    });
  }

  if (
    input.premium == null ||
    Number.isNaN(input.premium) ||
    input.premium <= 0 ||
    input.premium > 5000
  ) {
    errors.push({ field: "premium", message: "Missing selected plan premium." });
  }

  if (
    input.deductible != null &&
    (Number.isNaN(input.deductible) || input.deductible < 0 || input.deductible > 2500)
  ) {
    errors.push({ field: "deductible", message: "Invalid deductible." });
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

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function generateCancellationLetter(
  input: SwitchRequestInput,
  now = new Date()
): string {
  const { cancellationDeadline } = getSwitchDates(now);
  const fullName = `${input.firstName} ${input.lastName}`;

  return `${fullName}
${input.street}
${input.postcode} ${input.city}

${input.currentInsurerName}
[Insurer mailing address — please verify against your policy documents]

${input.city}, ${formatDate(now)}

Subject: Ordinary termination of compulsory health insurance (KVG/LAMal)

Dear Sir or Madam,

I hereby give notice of ordinary termination of my compulsory health insurance policy (KVG/LAMal)${input.policyNumber ? `, policy number ${input.policyNumber},` : ""} effective 31 December ${cancellationDeadline.getFullYear()}, in accordance with Art. 7 KVG.

Policyholder details:
Name: ${fullName}
Date of birth: ${input.birthDate}
Address: ${input.street}, ${input.postcode} ${input.city}

Please confirm this termination in writing.

Yours faithfully,

${fullName}
(Signature required if sending by post)

---
Prepared by PremiumSwitch on ${formatDate(now)}. This letter is provided in English for MVP purposes — if your insurer requires German, French, or Italian correspondence, please translate before sending.`;
}

export function generateApplicationSummary(
  input: SwitchRequestInput,
  now = new Date()
): string {
  const { effectiveDate } = getSwitchDates(now);
  const fullName = `${input.firstName} ${input.lastName}`;

  return `NEW HEALTH INSURANCE APPLICATION — REQUEST SUMMARY
Prepared by PremiumSwitch on ${formatDate(now)}

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
Requested start date: 1 January ${effectiveDate.getFullYear()}

Switching from: ${input.currentInsurerName}`;
}
