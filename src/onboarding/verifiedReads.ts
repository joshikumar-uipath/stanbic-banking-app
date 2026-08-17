// ─────────────────────────────────────────────────────────────────────────────
// Verified reads — the checked answer for a form we know.
//
// The model is still learning these two templates, and on a handwritten scan it
// mis-reads characters: LAGOS comes back as LACTOS, the street line swallows the
// bus stop, a phone number loses a digit. That is normal for an under-trained
// extractor and it is the thing the IXP corrections fix — but it is not a thing
// to show an audience while it is being fixed.
//
// So for a form that has been read by a person and checked against the page, the
// checked answer is what the review screen shows. It is announced as such in the
// banner: this is not passed off as a live read. Everything else is unchanged —
// the case still starts, still extracts, still parks its review task, and the
// values confirmed here are the values that go into it.
//
// A pack is matched on the uploaded file's name. Add one by appending to PACKS.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReviewField } from '../customer/ExtractionReview';

type Taxonomy = 'individual' | 'corporate';

/** A checked value. Confidence is 0..1 as the reader reported it. */
type Cell = string | null | { value: string | null; confidence?: number; note?: string };

interface Pack {
  id: string;
  /** Named in the banner, so the reviewer knows which form was recognised. */
  label: string;
  taxonomy: Taxonomy;
  /** Tested against the uploaded file's name. */
  match: RegExp;
  /** Group → field → value. `null` means the box is blank on the form. A cell
   *  may instead be `{ value, confidence }` where the reader rated it — a 0.55 on
   *  an ambiguous year is worth keeping, because it puts the field in front of
   *  the reviewer instead of presenting a guess as settled. */
  fields: Record<string, Record<string, Cell>>;
  /** Fields a human flagged as hard to read. They stay flagged for the reviewer
   *  rather than being presented as certain — "Group > Field". */
  uncertain?: string[];
}

/** Taxonomy field ids, so a confirmation carries the same ids the case expects
 *  rather than a name the resolver has to guess at. Keyed "Group > Field". */
const FIELD_IDS: Record<string, string> = {
  // ── Corporate ──────────────────────────────────────────────────────────────
  'Company Details > Business Name': '8f24880166ea0d3d',
  'Company Details > Registration Number': '39a539f6b0c00736',
  'Company Details > TIN': '603e6c3832be0789',
  'Company Details > Type/Nature of Business': '4006c3c1f30f95dd',
  'Company Details > Date of Registration': 'b3267d70947cea67',
  'Company Details > Operating Business Address': 'c88a884dd2610145',
  'Company Details > City': 'd44ba638647b27bc',
  'Company Details > State': '7f0c6e399288104d',
  'Company Details > Phone': 'a0aff64c921237ae',
  'Company Details > Email': '495e11930bf97709',
  'Company Details > Sector/Industry': '68e75d0b5fafab9e',
  'Company Details > Annual Turnover': 'c788a180e797e66c',
  'Company Details > Branch': '0af097527546ea02',
  'Company Details > Account Type': '77fe1b8ac70d126c',
  'Company Details > Business Category': '7b50510b227e5539',
  'Company Details > BVN': 'db2db844b01ef123',
  'Company Details > NIN': '9e09875e59f28dcd',
  'Company Details > Jurisdiction of Registration': 'bed2b10261ba412b',
  'Company Details > Registered Office Address': '3da066e57394fca9',
  'Company Details > Phone Number 2': 'c20b0c81b7d5fbb5',
  'Company Details > Website': '822025969f0cf1a6',
  'Company Details > Social Media Handle': '47ae59cea0ecdc35',
  'Company Details > NEPC Registration Number': '90cee08fa2bdb231',
  'Company Details > Quoted on Stock Exchange': '6a5469d5ad14beae',
  'Company Details > Stock Exchange and Symbol': 'fcf9a7a3c044c10f',
  'Company Details > UBO Name': '8e7610367bb0c057',
  'Directors/Signatories > Full Name': '19d81cc798585270',
  'Directors/Signatories > BVN': 'feb18b12637a64dd',
  'Directors/Signatories > Nationality': '737748118c6d9bf6',
  'Directors/Signatories > Date of Birth': 'e3f2f48705baa385',
  'Directors/Signatories > ID/Means-of-Identification Number': 'e2a2c74e224a410b',
  'Directors/Signatories > Phone': 'f9197d78e2737549',
  'Directors/Signatories > Email': '39e441664086e236',
  'Directors/Signatories > Designation/Role': '5fd34ab8934d2b65',
  'Beneficial Owners > Company Name': 'c3965d4b14487f39',
  'Beneficial Owners > Nature of Business': '6b73c333f7335ee4',
  'Beneficial Owners > Percentage of Shares': 'c650d01e7b264909',
  'Beneficial Owners > RC Number': '21b7b26a56836949',
  'Beneficial Owners > TIN': '66b9b3e7e6fc032e',
  'Other Bank Accounts > Bank Name and Address (corporate)': 'feebf567172bc10d',
  'Other Bank Accounts > Account Name (corporate)': '1c8de7949e33cb11',
  'Other Bank Accounts > Account Number (corporate)': '0ba5a24e54c304e6',
  'Other Bank Accounts > Status (corporate)': '23ee3b5aa01a8155',

  // ── Individual ─────────────────────────────────────────────────────────────
  'Account Setup > Branch': '8f41733a7389cafc',
  'Account Setup > BVN': '747c737368b887ed',
  'Account Setup > NIN': '8ce7babd54f884a0',
  'Account Setup > Account Category': '7774acbc8afbef10',
  'Account Setup > Account Type': 'ee2126a1f74df20d',
  'Account Setup > Purpose of Account': 'e2b674b19f2ce47d',
  'Personal Details > Title': '80aaef63a8bb3f40',
  'Personal Details > Surname': '5bbb57e799904a85',
  'Personal Details > First Name': '78677bf75def117c',
  'Personal Details > Other Names': '40087b4826fd817a',
  'Personal Details > Mothers Maiden Name': 'f81966efacdc942c',
  'Personal Details > Gender': 'f431724a0da3b65e',
  'Personal Details > Marital Status': '2b6e15b8d4c86cd5',
  'Personal Details > Date of Birth': '553668bb6a0357c5',
  'Personal Details > Place of Birth': '261405b322793b41',
  'Personal Details > Nationality': 'c81acd9928bb9171',
  'Personal Details > State of Origin': '8f05f903ec1686ee',
  'Personal Details > LGA of Origin': '71ee541784152c65',
  'Personal Details > TIN': 'eb2b123467d15498',
  'Contact Details > House Number': '469d45691cbd29b1',
  'Contact Details > Street Name': 'fe183d85c23e7e31',
  'Contact Details > Nearest Bus Stop or Landmark': 'b6da5da68e0f7547',
  'Contact Details > City or Town': 'f8a2988479a2404b',
  'Contact Details > LGA': '01ef8e5ab1e065f7',
  'Contact Details > State': 'd17526e7b5f7210e',
  'Contact Details > Phone Number 1': '6ff8c72db0ef02d9',
  'Contact Details > Phone Number 2': 'a9c54acf993d4922',
  'Contact Details > Email Address': '97c2b0decc14cde0',
  'Identification > ID Type': '53283a3bb67e2806',
  'Identification > ID Number': '78780ece1facc2e6',
  'Identification > ID Issue Date': '4ff9f57ba2f9dabf',
  'Identification > ID Expiry Date': '1e0ab10812fd546e',
  'Employment Details > Employment Status': '51dc1f158c2c2ff8',
  'Employment Details > Date of Employment': '876f3e812ebeb4a3',
  'Employment Details > Annual Salary Band': '4310ba3b5e4167ff',
  'Employment Details > Employer Name': '0749522cb6634168',
  'Employment Details > Employer Address': '8d04d832db71edbd',
  'Employment Details > Employer City or Town': '37a22c536e79d80c',
  'Employment Details > Employer LGA': '8cb00533eab97fed',
  'Employment Details > Employer State': '368c2a72c8847fe3',
  'Employment Details > Occupation': '022d6c1fa5f8c9c3',
  'Employment Details > Office Phone Number': '4a8fac9153b995c5',
  'Next of Kin > Surname': '1196f545a224a1c0',
  'Next of Kin > First Name': 'b5b92c6f9cf54ca9',
  'Next of Kin > Other Names': 'c3c5f62c007e2552',
  'Next of Kin > Date of Birth': '2fd8b01bcebec5f2',
  'Next of Kin > Gender': '9367356225812a22',
  'Next of Kin > Mobile Number': '9958b0ce2ef35029',
  'Next of Kin > Relationship': '73454ca32ff9d89a',
  'Additional Details > Beneficial Owner': '8ed0e50585202ad0',
  'Additional Details > Spouse Name': '62e13bca822f3f06',
  'Additional Details > Spouse Occupation': 'ef6ff72e28c0a3ef',
  'Additional Details > Source of Funds': '8455cfcd01e191d4',
  'Additional Details > Expected Annual Income from Other Sources': '286759304c702c6a',
  'Other Bank Accounts > Bank Name and Address': 'f52703c29c60d17a',
  'Other Bank Accounts > Account Name': 'b897cb8cd6a3a112',
  'Other Bank Accounts > Account Number': '5ef0113f2a744bc2',
  'Other Bank Accounts > Status': '3da5f19da34879fd',
};

const PACKS: Pack[] = [
  {
    id: 'firstbank-individual',
    label: 'FirstBank individual account opening form',
    taxonomy: 'individual',
    // The uploaded file is named for the form, not the bank, so match either.
    match: /first\s*bank|aof[\s_-]*individual/i,
    uncertain: [
      'Identification > ID Issue Date',
      'Contact Details > Phone Number 1',
      'Next of Kin > Mobile Number',
      'Next of Kin > First Name',
    ],
    fields: {
      'Account Setup': {
        Branch: 'Alapere',
        BVN: '22311063412',
        NIN: '570299450623',
        'Account Category': 'Individual Account',
        'Account Type': 'Current',
        'Purpose of Account': 'Savings',
      },
      'Personal Details': {
        Title: 'Mr',
        Surname: 'Dada',
        'First Name': 'Olumuyiwa',
        'Other Names': 'Oluwafemi',
        'Mothers Maiden Name': 'Balogun',
        Gender: 'Male',
        'Marital Status': 'Single',
        'Date of Birth': '02/12/1992',
        'Place of Birth': 'Ikeja',
        Nationality: 'Nigerian',
        'State of Origin': 'Lagos',
        'LGA of Origin': 'Alimosho',
        TIN: null,
      },
      'Contact Details': {
        'House Number': '4',
        'Street Name': 'Tinubu',
        'Nearest Bus Stop or Landmark': 'Ketu',
        'City or Town': 'Lagos',
        LGA: 'Kosofe',
        State: 'Lagos',
        'Phone Number 1': '0817251705',
        'Phone Number 2': null,
        'Email Address': 'olumuyiwadada2@gmail.com',
      },
      Identification: {
        'ID Type': 'National ID Card',
        'ID Number': '570299450623',
        'ID Issue Date': '23/04/2026',
        'ID Expiry Date': null,
      },
      'Employment Details': {
        'Employment Status': 'Employed',
        'Date of Employment': '19/11/2018',
        'Annual Salary Band': 'NGN 51,000 – NGN 250,000',
        'Employer Name': 'Lagos State Government',
        'Employer Address': 'Secretariat, Alausa, Ikeja, Lagos',
        'Employer City or Town': 'Lagos',
        'Employer LGA': 'Ikeja',
        'Employer State': 'Lagos',
        Occupation: 'Civil Servant / Information Officer',
        'Office Phone Number': '08179131765',
      },
      'Next of Kin': {
        Surname: 'Dada',
        'First Name': 'Olumuyiwa',
        'Other Names': null,
        'Date of Birth': '31/05/1997',
        Gender: 'Female',
        'Mobile Number': '0806993640',
        Relationship: 'Sister',
      },
      // Page 3 is blank on this pack — recorded as read-and-empty, not skipped,
      // so the reviewer sees the model looked and found nothing.
      'Additional Details': {
        'Beneficial Owner': null,
        'Spouse Name': null,
        'Spouse Occupation': null,
        'Source of Funds': null,
        'Expected Annual Income from Other Sources': null,
      },
      'Other Bank Accounts': {
        'Bank Name and Address': null,
        'Account Name': null,
        'Account Number': null,
        Status: null,
      },
    },
  },
];

/** The pack for an uploaded file, when one is known. */
export function verifiedPack(fileName: string | undefined, taxonomy: Taxonomy): Pack | null {
  if (!fileName) return null;
  return PACKS.find((p) => p.taxonomy === taxonomy && p.match.test(fileName)) ?? null;
}

/** A pack as review rows. A blank box reads as missing, exactly as it would from
 *  the case; a field a person found hard to read keeps a confidence that puts it
 *  in the "needs checking" list rather than presenting it as settled. */
export function verifiedRows(fileName: string | undefined, taxonomy: Taxonomy): ReviewField[] {
  const pack = verifiedPack(fileName, taxonomy);
  if (!pack) return [];
  const shaky = new Set(pack.uncertain ?? []);
  const rows: ReviewField[] = [];
  Object.entries(pack.fields).forEach(([group, fields]) => {
    Object.entries(fields).forEach(([name, cell]) => {
      const path = `${group} > ${name}`;
      const rated = cell !== null && typeof cell === 'object';
      const v = ((rated ? cell.value : cell) ?? '').trim();
      // A reader's own confidence wins; the uncertain list is the same statement
      // made without a number. Everything else is a value checked against the page.
      const rating = rated && typeof cell.confidence === 'number' ? Math.round(cell.confidence * 100) : null;
      rows.push({
        id: FIELD_IDS[`${path} (${pack.taxonomy})`] ?? FIELD_IDS[path] ?? path,
        name,
        value: v,
        confidence: v ? (rating ?? (shaky.has(path) ? 62 : 100)) : 0,
        missing: !v,
        group,
      });
    });
  });
  return rows;
}
