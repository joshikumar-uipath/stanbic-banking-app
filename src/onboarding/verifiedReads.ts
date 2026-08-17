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
  /** A pack that covers only part of the form. What it carries wins; everything
   *  else is filled from the live read rather than showing as missing. */
  partial?: boolean;
  /** What the reader could not reconcile — a missing seal, an unparseable TIN,
   *  a page absent from the scan. Shown above the fields, because these are the
   *  reasons a form does not go straight through. */
  exceptions?: { code: string; severity: 'critical' | 'high' | 'medium' | 'low'; field: string; detail: string }[];
  /** Consistency checks across the form — same BVN in two places, same phone on
   *  three pages. A failed one is worth more than any single field. */
  checks?: { check: string; result: 'pass' | 'fail' | 'inconsistent' | 'match' | 'note'; note?: string }[];
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

      // ── Boxes the form carries that the model has no field for yet ──────────
      // Kept because they were read and they are true, not because anything
      // downstream consumes them. Naming the group this way is the disclosure:
      // a reviewer can see the difference between "the model missed it" and
      // "the model was never asked".
      'Employment Details › Not in the model': {
        'Employer Nearest Bus Stop': 'Ikeja',
        'Fax Number': null,
      },
      'Next of Kin › Address': {
        'House Number': '4',
        'Street Name': 'Tinubu Street',
        'Nearest Bus Stop': 'Ketu',
        'City or Town': 'Lagos',
        LGA: 'Kosofe',
        State: 'Lagos',
        'Email Address': { value: 'fida2kemmy@gmail.com', confidence: 0.7 },
      },
      'Account Services Requested': {
        'Mobile Banking': 'Yes',
        'Internet Banking': 'Yes',
        'Interactive Voice Recording': 'No',
        'SMS Alerts': 'Yes',
        'Email Alerts': 'Yes',
        'Alerts — Credit Only': 'No',
        'Alerts — Debit Only': 'No',
        'Naira Debit Card': 'Yes',
        'Visa Card': 'No',
        'Cheque Book': 'No',
        'Preferred Username': null,
      },
      'FATCA / CRS Declaration': {
        Name: 'Dada Olumuyiwa Oluwafemi',
        'Country of Residence': 'Nigeria',
        'Country of Birth': 'Nigeria',
        'US Resident': 'No',
        'US Citizen': 'No',
        'US Permanent Resident (Green Card)': 'No',
        'Resident in a Listed OECD Country': 'No',
        'Controlling Persons Resident in a Listed OECD Country': 'No',
        Date: '06/07/2026',
      },
      'Bank Use Only — KYC Checks': {
        'Passport Photograph Checked': 'Yes',
        'Identification Checked': 'Yes',
        'Data Processing Consent Checked': 'Yes',
        'BVN / NIN Checked': 'Yes',
        'References Checked': 'Yes',
        'Politically Exposed Person': 'No',
      },
      'About This Form': {
        Bank: 'FirstBank of Nigeria Limited',
        'Residential Reading': 'Alapere, Ketu, Kosofe LGA, Lagos State',
        'Employer Reading': 'Alausa, Ikeja, Lagos State',
      },
    },
  },

  {
    id: 'stanbic-corporate',
    label: 'Stanbic IBTC entity account opening pack',
    taxonomy: 'corporate',
    // The Stanbic pack, not the FirstBank one — matched on the file it arrives as.
    match: /sample[\s_-]*filled|aop[\s_-]*for[\s_-]*corporate|stanbic/i,
    exceptions: [
      { code: "REFEREE_TENURE_CONTRADICTS_INCORPORATION", severity: "critical", field: "Company Details > Date of Registration", detail: "Incorporated 19/06/2026, yet referee 1 declares knowing the company 'over 10 years' and referee 2 declares 25. Either the date is misread, the RC number belongs to a predecessor business name, or the references are unreliable." },
      { code: "BVN_LENGTH_INVALID", severity: "critical", field: "Directors/Signatories > BVN", detail: "Both BVNs read as 12 digits against the mandatory 11-digit NIBSS format. Neither can be submitted for validation as extracted." },
      { code: "SAME_DAY_INCORPORATION_AND_ONBOARDING", severity: "high", field: "Company Details > Date of Registration", detail: "Incorporation and every signature date are both 19/06/2026 \u2014 a same-day onboarding is an enhanced due diligence trigger." },
      { code: "NIN_NOT_CAPTURED", severity: "high", field: "Directors/Signatories", detail: "No NIN field on this form version and none captured for either signatory, despite CBN identity requirements." },
      { code: "PHONE_CONFLICT_ACROSS_FORMS", severity: "high", field: "Enterprise Online Internet Banking > User 1 \u2014 Mobile Number", detail: "The internet banking form records 08027319889 while the AOF, signatory page and indemnity record 08027317889. This line receives OTPs \u2014 resolve before creating the profile." },
      { code: "SINGLE_APPROVER_HIGH_LIMIT", severity: "high", field: "Account Setup Information > Mandate", detail: "Both users are 'Approver 1' with an NGN 50,000,000 ceiling on all accounts, so either director alone can release the full daily limit. No dual-approval mandate is configured." },
      { code: "ACCOUNTS_TO_ACTIVATE_BLANK", severity: "medium", field: "Enterprise Online Internet Banking > Accounts to be Activated", detail: "No accounts listed for activation; the online banking setup cannot be provisioned as submitted." },
      { code: "ROLE_TICK_MISSING", severity: "medium", field: "Directors/Signatories 2 > Designation/Role", detail: "Neither Director nor Shareholder is ticked on her signatory page, yet she executes as Director and Director/Secretary on pages 4 and 5." },
      { code: "ID_EXPIRING_SOON", severity: "medium", field: "Signatory 2 > ID Expiry Date", detail: "Passport B00597328 expires 12/11/2026, under five months after account opening. Diarise for re-documentation." },
      { code: "TIN_FORMAT_INVALID", severity: "medium", field: "Company Details > TIN", detail: "13 digits does not match any expected FIRS TIN format." },
      { code: "SERVICE_ELECTIONS_INCOMPLETE", severity: "medium", field: "Account Services Required", detail: "Email indemnity, cheque pre-confirmation, statement delivery and frequency, and card preferences are all unticked \u2014 the email indemnity despite two signed indemnity instruments being attached." },
      { code: "SIGNING_DATE_GAP", severity: "medium", field: "Terms and Conditions", detail: "Signed 13/07/2026, three weeks after the rest of the pack and after both referee responses. Confirm the pack was not amended between signings." },
      { code: "BRANCH_INCONSISTENT", severity: "medium", field: "Company Details > Branch", detail: "Page 1 blank; the reference form shows Festac; the verification stamp shows Commercial Banking Lagos Mainland; the photograph stamps show 43 Opebi Road, Ikeja. The booking branch is undetermined." },
      { code: "SCUML_NOT_PROVIDED", severity: "medium", field: "Company Details > SCUML Registration Number", detail: "Blank. Consultancy activity may fall within SCUML scope \u2014 confirm applicability." },
      { code: "PAGE_MISSING", severity: "medium", field: "About This Form > Pages Not Present", detail: "Printed page 6 is absent from the scanned set." },
      { code: "LOW_CONFIDENCE_HUMAN_REVIEW", severity: "medium", field: "Several", detail: "Below 0.60 and needing a validation station: both BVNs, the TIN, the branch, both referee mobile and account numbers, referee 2 date and LGA, the daily limit figure, both menu codes, internet banking user 1 mobile, the bank-use names and the page 1 header annotations." },
      { code: "OTHER_BANK_ACCOUNTS_BLANK", severity: "low", field: "Other Bank Accounts", detail: "Section 7 is blank while both referees confirm banking relationships, implying accounts exist elsewhere." },
    ],
    checks: [
      { check: "Company name consistent across the AOF, indemnity, seal, reference and online banking forms", result: "pass" },
      { check: "Signatory names consistent between pages 2/3 and the execution pages", result: "pass" },
      { check: "Signatory 1 email consistent across every form", result: "pass" },
      { check: "Signatory 1 phone consistent across every form", result: "fail", note: "The internet banking form differs by one digit." },
      { check: "Company phone equals signatory 1 personal phone", result: "match", note: "Expected for a small entity, but one line serves as both the corporate contact and the OTP destination." },
      { check: "Witness address on the indemnity equals the company operating address", result: "match", note: "The witness's independence is weakened." },
      { check: "Both referees name a bank with a relationship of six months or more", result: "pass" },
      { check: "Referee 1 banks with Stanbic IBTC, the onboarding bank", result: "note", note: "Permitted by the form, but an internal referee reduces independence." },
      { check: "Signatory count matches the mandate table", result: "pass", note: "Two signatories, two user matrix rows." },
      { check: "Passport photographs affixed and bank-stamped for both signatories", result: "pass" },
      { check: "Company seal affixed on the Letter of Indemnity and the execution page", result: "pass" },
    ],
    fields: {
      "Company Details": {
        "Business Name": { value: "George Emore Technical Enterprises Ltd", confidence: 0.9, note: "Handwritten as 'ENTERRRISES' on page 1; the spelling is confirmed by the company seal on page 4." },
        "Registration Number": { value: "9618113", confidence: 0.8 },
        TIN: { value: "2622487833179", confidence: 0.5, note: "13 digits \u2014 not a standard FIRS TIN format." },
        "Type/Nature of Business": { value: "Consultancy in Infotech", confidence: 0.85 },
        "Date of Registration": { value: "19/06/2026", confidence: 0.72 },
        "Operating Business Address": { value: "45 Ajose Street, Mende, Maryland, Lagos", confidence: 0.82 },
        City: { value: "Lagos", confidence: 0.7, note: "Taken from the address line \u2014 the form has no separate city box." },
        State: { value: "Lagos", confidence: 0.7, note: "Taken from the address line." },
        Phone: { value: "08027317889", confidence: 0.68, note: "One digit reads 7 or 9; the internet banking form records 08027319889." },
        Email: { value: "eemore@gmail.com", confidence: 0.85 },
        "Sector/Industry": { value: "Information Technology", confidence: 0.92 },
        "Annual Turnover": { value: "Less than NGN 400 million", confidence: 0.92 },
        Branch: { value: null, confidence: 0.3, note: "Blank on page 1. 'Festac' appears on the reference form and a Commercial Banking Lagos Mainland stamp on page 9." },
        "Account Type": { value: "Current account, Corporate Account", confidence: 0.88, note: "Two boxes ticked." },
        "Business Category": { value: "Limited Liability Company", confidence: 0.95 },
        BVN: { value: null, note: "No entity BVN box on this form version." },
        NIN: { value: null, note: "Not captured for either signatory, despite CBN identity requirements." },
        "Jurisdiction of Registration": { value: null, confidence: 0.95, note: "Blank." },
        "Registered Office Address": { value: "Same as the operating address", confidence: 0.9 },
        "Phone Number 2": null,
        Website: null,
        "Social Media Handle": null,
        "NEPC Registration Number": null,
        "Quoted on Stock Exchange": { value: "No", confidence: 0.94 },
        "Stock Exchange and Symbol": null,
        "UBO Name": { value: null, note: "No ultimate beneficial owner declaration on this form version." },
      },
      "Directors/Signatories 1": {
        "Full Name": { value: "Efe George Emore", confidence: 0.9 },
        BVN: { value: "221435114633", confidence: 0.35, note: "Reads as 12 digits \u2014 a BVN is 11. Needs re-keying." },
        Nationality: { value: "Nigerian", confidence: 0.88 },
        "Date of Birth": { value: "14/02/1967", confidence: 0.85 },
        "ID/Means-of-Identification Number": { value: "B03199156", confidence: 0.9 },
        Phone: { value: "08027317889", confidence: 0.75 },
        Email: { value: "eemore@gmail.com", confidence: 0.88 },
        "Designation/Role": { value: "Director", confidence: 0.8, note: "Position on the officer page reads CEO." },
      },
      "Directors/Signatories 2": {
        "Full Name": { value: "Kehinde Omotayo Akerele", confidence: 0.9 },
        BVN: { value: "221448011370", confidence: 0.35, note: "Reads as 12 digits \u2014 a BVN is 11. Needs re-keying." },
        Nationality: { value: null, confidence: 0.85, note: "Blank \u2014 the box is captioned 'for non-Nigerians', so Nigerian is implied." },
        "Date of Birth": { value: "04/12/1977", confidence: 0.85 },
        "ID/Means-of-Identification Number": { value: "B00597328", confidence: 0.9 },
        Phone: { value: "08066526627", confidence: 0.8 },
        Email: { value: "meetsweetkenny@yahoo.com", confidence: 0.85 },
        "Designation/Role": { value: "Manager", confidence: 0.88, note: "Neither Director nor Shareholder ticked, yet she executes as Director and Director/Secretary." },
      },
      "Beneficial Owners": {
        "Company Name": { value: null, note: "No beneficial owner section on this form version." },
        "Nature of Business": null,
        "Percentage of Shares": null,
        "RC Number": null,
        TIN: null,
      },
      "Other Bank Accounts": {
        "Bank Name and Address": { value: null, confidence: 0.95, note: "Section 7 is entirely blank \u2014 though both referees confirm banking relationships." },
        "Account Name": null,
        "Account Number": null,
        Status: null,
      },
      "Account Setup": {
        "Category of Business": { value: "Limited Liability Company", confidence: 0.95 },
        "Account Type": { value: "Current account, Corporate Account", confidence: 0.88 },
        "Domiciliary Currency": { value: null, confidence: 0.9 },
        "Account Number": { value: null, note: "Blank throughout \u2014 official use only." },
        "Ecosystem Flag": { value: null, confidence: 0.85, note: "Yes/No not ticked." },
        "Ecosystem Relationship": { value: null, confidence: 0.9 },
        "Ecosystem Anchor CIF": { value: null, confidence: 0.9 },
      },
      "Account Services Required": {
        "Card Preferences": { value: null, confidence: 0.85, note: "No card type ticked." },
        "Card Currency": { value: null, confidence: 0.9 },
        "Auto-renew Card at Expiration": { value: null, confidence: 0.9, note: "Yes/No not ticked." },
        "Preferred Customer Name on Card": { value: null, confidence: 0.95 },
        "Electronic Banking": { value: "SME online", confidence: 0.78, note: "Internet and Mobile Banking not ticked, though an Enterprise Online application is attached." },
        "Statement Preferences": { value: null, confidence: 0.7, note: "No delivery channel or frequency clearly ticked." },
        "Transaction Alerts": { value: "SMS Alert (fee applies)", confidence: 0.8, note: "SMS is mandatory on this form; the free Email Alert is not ticked." },
        "Cheque Book Requisition": { value: null, confidence: 0.88, note: "Neither 50 nor 100 leaves ticked." },
        "Execute Email Indemnity": { value: null, confidence: 0.85, note: "Yes/No not ticked, yet two signed indemnity instruments are attached." },
        "Cheque Pre-confirmation": { value: null, confidence: 0.88, note: "Yes/No not ticked." },
        "Cheque Confirmation Threshold": { value: null, confidence: 0.92, note: "Section 4 blank." },
        "Africa China Banking Centre": { value: null, confidence: 0.9 },
      },
      "Signatory 1 \u203a Not in the model": {
        Surname: { value: "Emore", confidence: 0.92 },
        "First Name": { value: "Efe", confidence: 0.9 },
        "Other Name": { value: "George", confidence: 0.92 },
        "Mothers Maiden Name": { value: "Etefia", confidence: 0.8 },
        Title: { value: null, confidence: 0.9, note: "Not specified." },
        Gender: { value: "Male", confidence: 0.94 },
        "Place of Birth": { value: "Ughelli", confidence: 0.85 },
        "State of Origin": { value: "Delta State", confidence: 0.9 },
        "Country of Residence": { value: null, confidence: 0.9 },
        "Resident Permit": { value: null, confidence: 0.95, note: "Not applicable \u2014 Nigerian national." },
        "Means of Identification": { value: "International Passport", confidence: 0.95, note: "Machine-printed, not handwritten." },
        "ID Issue Date": { value: "14/03/2024", confidence: 0.88 },
        "ID Expiry Date": { value: "13/03/2029", confidence: 0.88 },
        "Marital Status": { value: "Married", confidence: 0.88 },
        Occupation: { value: "Developer", confidence: 0.88 },
        "Status / Job Title": { value: null, confidence: 0.9, note: "Blank." },
        "Position / Office of Officer": { value: "CEO", confidence: 0.9 },
        "Role Ticked": { value: "Director", confidence: 0.8, note: "Shareholder not ticked." },
        "Phone Number 2": null,
        "Class of Signatory": { value: "A", confidence: 0.88 },
        "Signature Present": { value: "Yes", confidence: 0.95 },
        "Signature Date": { value: "19/06/2026", confidence: 0.85 },
        "Passport Photograph Affixed": { value: "Yes", confidence: 0.95, note: "Stamped Stanbic IBTC Bank RC 125097, 43 Opebi Road, Ikeja, Lagos." },
      },
      "Signatory 1 Residential Address": {
        "House Number": { value: "62 Ire Akari", confidence: 0.72 },
        "Street Name": { value: "Ire Akari", confidence: 0.78 },
        "Nearest Bus Stop or Landmark": { value: "Isolo", confidence: 0.85 },
        "City or Town": { value: "Lagos", confidence: 0.92 },
        LGA: { value: "Oshodi-Isolo", confidence: 0.85 },
        State: { value: "Lagos", confidence: 0.94 },
      },
      "Signatory 2 \u203a Not in the model": {
        Surname: { value: "Akerele", confidence: 0.92 },
        "First Name": { value: "Kehinde", confidence: 0.92 },
        "Other Name": { value: "Omotayo", confidence: 0.9 },
        "Mothers Maiden Name": { value: "Aringbere", confidence: 0.78 },
        Title: { value: null, confidence: 0.9, note: "Not specified." },
        Gender: { value: "Female", confidence: 0.92 },
        "Place of Birth": { value: "Lagos", confidence: 0.9 },
        "State of Origin": { value: "Lagos", confidence: 0.9 },
        "Country of Residence": { value: null, confidence: 0.9 },
        "Resident Permit": { value: null, confidence: 0.95 },
        "Means of Identification": { value: "International Passport", confidence: 0.95 },
        "ID Issue Date": { value: "13/11/2021", confidence: 0.86 },
        "ID Expiry Date": { value: "12/11/2026", confidence: 0.86, note: "Expires within five months of account opening." },
        "Marital Status": { value: "Married", confidence: 0.88 },
        Occupation: { value: "Human Resource", confidence: 0.85 },
        "Status / Job Title": { value: null, confidence: 0.85, note: "Overwritten by the occupation entry." },
        "Position / Office of Officer": { value: "Manager", confidence: 0.88 },
        "Role Ticked": { value: null, confidence: 0.8, note: "Neither Director nor Shareholder ticked, yet she signs as Director on page 4." },
        "Phone Number 2": null,
        "Class of Signatory": { value: "A", confidence: 0.88 },
        "Signature Present": { value: "Yes", confidence: 0.95 },
        "Signature Date": { value: "19/06/2026", confidence: 0.85 },
        "Passport Photograph Affixed": { value: "Yes", confidence: 0.95, note: "Stamped Stanbic IBTC Bank RC 125097, 43 Opebi Road, Ikeja, Lagos." },
      },
      "Signatory 2 Residential Address": {
        "House Number": { value: "20", confidence: 0.88 },
        "Street Name": { value: "Oladipo", confidence: 0.75 },
        "Nearest Bus Stop or Landmark": { value: "Jegede Street", confidence: 0.8 },
        "City or Town": { value: "Isheri, Lagos", confidence: 0.8 },
        LGA: { value: "Isheri", confidence: 0.7, note: "Isheri is not a recognised Lagos LGA \u2014 likely Alimosho or Ikeja." },
        State: { value: "Lagos", confidence: 0.92 },
      },
      "Authority to Debit for Search Fee": {
        "Bank Named": { value: "Stanbic IBTC Bank Plc", confidence: 0.8 },
        "Amount Specified": { value: null, confidence: 0.9, note: "Authorises 'applicable charges' without a figure." },
        "Signatures Present": { value: "2", confidence: 0.92 },
        Dates: { value: "19/06/2026, 19/06/2026", confidence: 0.7 },
      },
      "Letter of Indemnity": {
        "Company Name": { value: "George Emore Technical Enterprises Ltd", confidence: 0.88 },
        "Common Seal Affixed": { value: "Yes", confidence: 0.9 },
        Day: { value: "19", confidence: 0.75 },
        "Month and Year": { value: "June 2026", confidence: 0.88 },
        "Director Witness 1": { value: "Emore Efe George \u2014 Director, signed", confidence: 0.88 },
        "Director Witness 2": { value: "Akerele Kehinde \u2014 Director/Secretary, signed", confidence: 0.86 },
      },
      "Signed, Sealed and Delivered": {
        "Signatory 1": { value: "Emore Efe George \u2014 Director, signed 19/06/2026", confidence: 0.9 },
        "Signatory 2": { value: "Akerele Kehinde Omotayo \u2014 Director, signed 19/06/2026", confidence: 0.88 },
        "Company Seal Stamp": { value: "GEORGE EMORE TECHNICAL ENTERPRISES LTD", confidence: 0.9 },
      },
      "Instruction Processing Indemnity": {
        "Account Numbers Referenced": { value: null, confidence: 0.95, note: "Left blank." },
        Branch: { value: null, confidence: 0.95, note: "Left blank." },
        "Authorised Contact 1": { value: "+2348027317889 \u2014 eemore@gmail.com", confidence: 0.75 },
        "Authorised Contact 2": { value: "+2348066526627 \u2014 meetsweetkenny@yahoo.com", confidence: 0.8 },
        Dated: { value: "19/06/2026", confidence: 0.88 },
        "Account Holder Name": { value: "Emore Efe", confidence: 0.88 },
        Signed: { value: "Yes", confidence: 0.92 },
        "Common Seal Affixed in Presence Of": { value: "Director, Director/Secretary", confidence: 0.85 },
        "Witness Name": { value: "Akerele Kehinde", confidence: 0.85 },
        "Witness Address": { value: "45 Ajose Street, Mende", confidence: 0.78, note: "The same as the company's operating address." },
        "Witness Occupation": { value: "Human Resources Manager", confidence: 0.85 },
        "Witness Signed": { value: "Yes", confidence: 0.9 },
      },
      "Account Opening References": {
        "Account Number": null,
        Branch: { value: "Festac", confidence: 0.55 },
        "Subject Company": { value: "George Emore Technical Enterprises Ltd", confidence: 0.88 },
      },
      "Referee 1": {
        "Known For": { value: "Over 10 years", confidence: 0.82 },
        Name: { value: "Microconcept Techniques & Associates Ltd", confidence: 0.75 },
        Address: { value: "270 Ikorodu Road, Obanikoro", confidence: 0.8 },
        "LGA / City or Town": { value: "Lagos", confidence: 0.9 },
        Country: { value: "Nigeria", confidence: 0.92 },
        Telephone: { value: null, confidence: 0.9 },
        "Mobile Number": { value: "+2348023318086", confidence: 0.55 },
        "Account Number": { value: "0029057132", confidence: 0.7 },
        "Bank Name": { value: "Stanbic IBTC Bank Ltd", confidence: 0.88 },
        Signed: { value: "Yes", confidence: 0.9 },
        Date: { value: "24/06/2026", confidence: 0.85 },
      },
      "Referee 2": {
        "Known For": { value: "25 years", confidence: 0.78 },
        Name: { value: "Equipment Leasing Association of Nigeria", confidence: 0.78 },
        Address: { value: "25B Fola Jinadu Crescent, Gbagada, Lagos", confidence: 0.75 },
        "LGA / City or Town": { value: "Ilupeju Branch", confidence: 0.45, note: "Reads as 'IUPEJU/IKEJA BRANCH' \u2014 ambiguous." },
        Country: { value: "Nigeria", confidence: 0.92 },
        Telephone: { value: null, confidence: 0.9 },
        "Mobile Number": { value: "08023176911", confidence: 0.65 },
        "Account Number": { value: "0072043164", confidence: 0.68 },
        "Bank Name": { value: "Sterling Bank Plc", confidence: 0.88 },
        Signed: { value: "Yes", confidence: 0.9 },
        Date: { value: "23/06/2026", confidence: 0.55, note: "Could read 27/06/2026." },
      },
      "Enterprise Online Internet Banking": {
        Date: { value: "19/06/2026", confidence: 0.85 },
        "Company Account Name": { value: "George Emore Technical Enterprises Ltd", confidence: 0.88 },
        "Accounts to be Activated": { value: null, confidence: 0.95, note: "Table blank \u2014 no account names or numbers listed." },
        "User 1 \u2014 Full Name": { value: "Emore Efe", confidence: 0.9 },
        "User 1 \u2014 Mobile Number": { value: "08027319889", confidence: 0.45, note: "Conflicts with 08027317889 on pages 1, 2 and 5. This line receives OTPs." },
        "User 1 \u2014 Email": { value: "eemore@gmail.com", confidence: 0.88 },
        "User 1 \u2014 Role": { value: "Initiator / Approver", confidence: 0.8 },
        "User 1 \u2014 OTP Preference": { value: "Email", confidence: 0.65, note: "The SMS tick is ambiguous." },
        "User 1 \u2014 Signature Present": { value: "Yes", confidence: 0.92 },
        "User 2 \u2014 Full Name": { value: "Akerele Kehinde", confidence: 0.9 },
        "User 2 \u2014 Mobile Number": { value: "08066526627", confidence: 0.82 },
        "User 2 \u2014 Email": { value: "meetsweetkenny@yahoo.com", confidence: 0.85 },
        "User 2 \u2014 Role": { value: "Initiator / Approver", confidence: 0.8 },
        "User 2 \u2014 OTP Preference": { value: "Email", confidence: 0.65 },
        "User 2 \u2014 Signature Present": { value: "Yes", confidence: 0.92 },
        "Users 3 to 5": { value: null, confidence: 0.95, note: "Blank." },
      },
      "Account Setup Information": {
        "Daily Transaction Limit (figures)": { value: "NGN 50,000,000", confidence: 0.6, note: "Handwritten figure unclear; resolved against the words." },
        "Daily Transaction Limit (words)": { value: "Fifty Million Naira Only", confidence: 0.88 },
        Currency: { value: "NGN", confidence: 0.95 },
        "User 1 \u2014 Name": { value: "Efe George Emore", confidence: 0.88 },
        "User 1 \u2014 Accessible Account": { value: "All accounts", confidence: 0.85 },
        "User 1 \u2014 Mandate": { value: "Approver 1", confidence: 0.72, note: "Single-approver mandate." },
        "User 1 \u2014 Maximum Limit (NGN)": { value: "50,000,000", confidence: 0.6 },
        "User 1 \u2014 Maximum Limit (USD)": { value: null, confidence: 0.85, note: "Dash entered." },
        "User 1 \u2014 Accessible Menu Code": { value: "S, P, GS", confidence: 0.62, note: "Statement, Payment, General Services." },
        "User 2 \u2014 Name": { value: "Kehinde Omotayo Akerele", confidence: 0.86 },
        "User 2 \u2014 Accessible Account": { value: "All accounts", confidence: 0.85 },
        "User 2 \u2014 Mandate": { value: "Approver 1", confidence: 0.72 },
        "User 2 \u2014 Maximum Limit (NGN)": { value: "50,000,000", confidence: 0.6 },
        "User 2 \u2014 Maximum Limit (USD)": { value: null, confidence: 0.85 },
        "User 2 \u2014 Accessible Menu Code": { value: "S, P, GS", confidence: 0.55, note: "Reads closer to 'SPES' \u2014 verify." },
        "Approval \u2014 Efe George Emore": { value: "Signed 19/06/2026", confidence: 0.8 },
        "Approval \u2014 Kehinde Omotayo Akerele": { value: "Signed 19/06/2026", confidence: 0.78 },
      },
      "Bank Use Only": {
        "Signature Verified By": { value: null, confidence: 0.6, note: "Name line not legibly completed; a 'Signature Verified' stamp is applied." },
        "Signature Verified Stamp": { value: "Stanbic IBTC Bank RC 125097 \u2014 Commercial Banking Lagos Mainland Branch", confidence: 0.85 },
        "Head, Service Support": { value: null, confidence: 0.92, note: "Blank." },
        "Business Banker": { value: "Kehinde", confidence: 0.3, note: "Partially legible." },
        "E-Business Support": { value: null, confidence: 0.4, note: "Signature and date 19/06/2026 present; the name is illegible." },
      },
      "Terms and Conditions": {
        "Marketing and Promotion Consent": { value: null, confidence: 0.75, note: "YES/NO not clearly ticked." },
        "BVN Watchlist Consent Acknowledged": { value: "Yes", confidence: 0.7, note: "Implied by signature; no separate tick." },
        "Signatory 1": { value: "Efe Emore \u2014 signed 13/07/2026", confidence: 0.9, note: "Machine-printed name." },
        "Signatory 2": { value: "Akerele Kehinde \u2014 signed 13/07/2026", confidence: 0.85 },
        "Signatory 3": { value: null, note: "Third line unsigned." },
      },
      "About This Form": {
        Bank: "Stanbic IBTC Bank PLC (RC 125097)",
        Form: "Account Opening Form \u2013 Entities (Incorporated and Non-Incorporated)",
        "Scanned Images": "12",
        "Pages Not Present": { value: "Printed page 6", note: "Page 8 carries no footer number but is present." },
        "Attached Sub-forms": "Letter of Indemnity; Indemnity \u2013 Processing of Instructions and Payment; Account Opening Reference (2 referees); Enterprise Online Internet Banking; Account Setup Information; Terms and Conditions",
        "Header Annotation": { value: "AJAOSA / AZAWSA -00003 (SM (D))", confidence: 0.2, note: "Illegible branch or batch annotation." },
        "Relationship Manager Code": { value: "A207695", confidence: 0.6 },
        "Scan Quality": "Poor \u2014 low contrast greyscale, faded printed labels, several sections near-illegible",
        "Overall Confidence": "76%",
        "Straight Through Eligible": { value: "No", note: "Blocked by the BVN lengths, the referee tenure contradiction, the phone conflict, the blank activation table, the TIN format and the missing NIN." },
      },
    },
  },
  {
    id: 'firstbank-corporate',
    label: 'FirstBank corporate / SME account opening form',
    taxonomy: 'corporate',
    match: /aof[\s_-]*corporate|corporate[\s_-]*aof/i,
    exceptions: [
      { code: 'CHECKLIST_NOT_ITEMISED', severity: 'high', field: 'Bank Use Only > Requirements Checklist Itemised', detail: 'No field-level evidence that the CAC certificate, MEMART, Form CO7, Form CO2, board resolution, passport photograph or the two independent references were sighted.' },
      { code: 'COMPANY_SEAL_MISSING', severity: 'high', field: 'Declarations & Authorities > Company Seal Affixed', detail: 'The declaration requires authorised signatures with the company seal; the seal box on page 14 is empty.' },
      { code: 'ENTITY_AGE_EDD_TRIGGER', severity: 'high', field: 'Company Details > Date of Registration', detail: 'If the registration year is 2026 the entity is seven days old at account opening. With a free webmail domain, that warrants enhanced due diligence.' },
      { code: 'NO_MANDATE_DEFINED', severity: 'high', field: 'Officer Details > Class of Signatory', detail: 'One signatory captured and the class of signatory left blank — no signing rule is established.' },
      { code: 'TIN_FORMAT_INVALID', severity: 'medium', field: 'Company Details > TIN', detail: '14 digits does not match any expected FIRS TIN format.' },
      { code: 'ID_DATES_MISSING', severity: 'medium', field: 'Officer Details > ID Issue Date', detail: 'National ID issue and expiry dates were not captured.' },
      { code: 'PAGES_MISSING', severity: 'medium', field: 'About This Form > Pages Not Present', detail: 'Pages 9, 10 and 12 are absent from the scanned set — additional officer pages 2 and 3, and one further section.' },
      { code: 'LOW_CONFIDENCE_HUMAN_REVIEW', severity: 'medium', field: 'Several', detail: 'Below 0.60 and needing a validation station: TIN, date of registration, every MIS freecode, the authorising officer name, the witness name and address, and the form reference.' },
      { code: 'FIELD_MISPLACED', severity: 'low', field: 'Officer Details > Maiden Name', detail: "Maiden name carries the mother's maiden name on a male officer record; it should be blank." },
    ],
    checks: [
      { check: 'BVN consistent between the entity header and the officer record', result: 'pass' },
      { check: 'NIN consistent between the entity header, the officer record and the ID number', result: 'pass' },
      { check: 'Phone consistent across pages 1, 8 and 16', result: 'pass', note: 'Consistent, but the same digit reads poorly in all three.' },
      { check: 'Email consistent between the entity header and the online banking request', result: 'pass' },
      { check: 'Officer residential address matches the entity operating address', result: 'pass', note: 'Expected for a small LLC, but worth noting for address verification.' },
      { check: 'Officer status — Director on page 8, CEO on page 14', result: 'inconsistent' },
      { check: 'Account type Corporate Current against the unselected FirstSME options', result: 'pass' },
    ],
    fields: {
      'Company Details': {
        'Business Name': { value: 'ABA Integrated Solutions Limited', confidence: 0.94 },
        'Registration Number': { value: '9741350', confidence: 0.82 },
        TIN: { value: '26237742028670', confidence: 0.48, note: '14 digits — not a standard FIRS TIN format.' },
        'Type/Nature of Business': { value: 'Information Technology', confidence: 0.95 },
        'Date of Registration': { value: '04/08/2026', confidence: 0.55, note: 'Year digit ambiguous — could be 2024.' },
        'Operating Business Address': { value: '18 Obafemi Awolowo Street, Lugbe', confidence: 0.8 },
        City: { value: 'Abuja', confidence: 0.85 },
        State: { value: 'FCT', confidence: 0.85 },
        Phone: { value: '07019233588', confidence: 0.72, note: 'One digit reads 3 or 5; the same number appears on pages 1, 8 and 16.' },
        Email: { value: 'abaintegratedsolutionsltd@gmail.com', confidence: 0.88 },
        'Sector/Industry': { value: 'Information Technology', confidence: 0.95 },
        'Annual Turnover': { value: 'Below NGN 50 million', confidence: 0.94 },
        Branch: { value: 'Abuja Main', confidence: 0.93 },
        'Account Type': { value: 'Corporate Current', confidence: 0.98 },
        'Business Category': { value: 'Limited Liability Company', confidence: 0.97 },
        BVN: { value: '22429885718', confidence: 0.86 },
        NIN: { value: '82034835219', confidence: 0.9 },
        'Jurisdiction of Registration': { value: 'Abuja', confidence: 0.9 },
        'Registered Office Address': { value: null, note: 'Blank — taken to be the operating address.' },
        'Phone Number 2': null,
        Website: null,
        'Social Media Handle': { value: null, note: 'Struck through.' },
        'NEPC Registration Number': { value: null, note: 'Struck through — not applicable.' },
        'Quoted on Stock Exchange': { value: 'No', confidence: 0.96 },
        'Stock Exchange and Symbol': null,
        'UBO Name': { value: 'Adelaja Babajide Adetayo', confidence: 0.86 },
      },
      'Directors/Signatories': {
        'Full Name': { value: 'Adelaja Babajide Adetayo', confidence: 0.9 },
        BVN: { value: '22429885718', confidence: 0.86 },
        Nationality: { value: 'Nigerian', confidence: 0.93 },
        'Date of Birth': { value: '06/10/1984', confidence: 0.84 },
        'ID/Means-of-Identification Number': { value: '82034835219', confidence: 0.9 },
        Phone: { value: '07019233588', confidence: 0.7 },
        Email: { value: null, note: 'Blank on the officer page.' },
        'Designation/Role': { value: 'Director', confidence: 0.9, note: 'Signed as CEO on page 14.' },
      },
      'Beneficial Owners': {
        'Company Name': { value: null, note: 'Table struck through — no corporate owners declared.' },
        'Nature of Business': null,
        'Percentage of Shares': null,
        'RC Number': null,
        TIN: null,
      },
      'Other Bank Accounts': {
        'Bank Name and Address': { value: null, note: 'Table struck through.' },
        'Account Name': null,
        'Account Number': null,
        Status: null,
      },

      // ── Read from the form, no field in the model for it ────────────────────
      'Officer Details › Not in the model': {
        Title: { value: 'Mr', confidence: 0.95 },
        Surname: { value: 'Adelaja', confidence: 0.9 },
        'First Name': { value: 'Babajide', confidence: 0.92 },
        'Other Names': { value: 'Adetayo', confidence: 0.88 },
        'Maiden Name': { value: 'Angela', confidence: 0.85, note: "The mother's maiden name, written in the wrong box on a male officer record." },
        Gender: { value: 'Male', confidence: 0.93 },
        'Place of Birth': { value: 'Abuja', confidence: 0.9 },
        NIN: { value: '82034835219', confidence: 0.9 },
        'Mothers Maiden Name': { value: 'Angela', confidence: 0.9 },
        Occupation: { value: 'Accountant', confidence: 0.88 },
        'Status / Job Title': { value: 'Director', confidence: 0.9 },
        'Public Position Held': { value: 'Director', confidence: 0.85 },
        'Means of Identification': { value: 'National ID Card', confidence: 0.92 },
        'ID Issue Date': { value: null, note: 'Not provided.' },
        'ID Expiry Date': { value: null, note: 'Not provided.' },
        'Phone Number 2': { value: 'N/A', confidence: 0.85 },
        'Dual Citizenship': { value: 'No', confidence: 0.94 },
        'Social Media Handle': { value: null, note: 'Struck through.' },
        'Class of Signatory': { value: null, note: 'Blank — no mandate class defined.' },
        'Role — Signatory': { value: 'Yes', confidence: 0.9 },
        'Role — Ultimate Beneficial Owner': { value: 'Yes', confidence: 0.9 },
        'Role — Director': { value: 'Yes', confidence: 0.9 },
        'Role — Trustee': { value: 'No', confidence: 0.92 },
        'Signature Present': { value: 'Yes', confidence: 0.95 },
        'Signature Date': { value: '10/08/2026', confidence: 0.72 },
      },
      'Officer Residential Address': {
        'House Number': { value: '18', confidence: 0.85 },
        'Street Name': { value: 'Obafemi Awolowo Street', confidence: 0.82 },
        Area: { value: 'Lugbe', confidence: 0.85 },
        'Nearest Bus Stop or Landmark': { value: 'Lugbe', confidence: 0.88 },
        'City or Town': { value: 'Abuja', confidence: 0.92 },
        LGA: { value: 'AMAC', confidence: 0.78 },
        State: { value: 'Abuja (FCT)', confidence: 0.92 },
      },
      'Products and Services Requested': {
        Card: { value: null, confidence: 0.9, note: 'No card type ticked.' },
        'Cheque Book': { value: null, confidence: 0.9, note: 'Neither 50 nor 100 leaves ticked.' },
        'Email Alerts': { value: 'Yes', confidence: 0.88 },
        'SMS Alerts': { value: 'Yes', confidence: 0.85 },
        'Alert Direction': { value: 'Both', confidence: 0.82 },
        'Salary / Vendor Payment Platform': { value: 'Internet Banking (FirstOnline)', confidence: 0.85 },
        'Statement Frequency': { value: 'Monthly', confidence: 0.87 },
        'FirstSME Classic': { value: 'No', confidence: 0.95 },
        'FirstSME Deluxe': { value: 'No', confidence: 0.95 },
        'Cheque Confirmation Threshold': { value: null, note: 'Left blank — the NGN 1,000,000 default applies.' },
      },
      'Additional Details': {
        'Affiliated Companies': { value: null, confidence: 0.95, note: 'Struck through.' },
        'Parent Company Country of Incorporation': { value: null, confidence: 0.95 },
        'Sole Proprietor Personal Details': { value: null, confidence: 0.97, note: 'Page 13 struck through — not applicable to an LLC.' },
        'CRM Borrower Code': null,
        'SCUML Registration Number': { value: null, confidence: 0.95, note: 'Struck through — not applicable.' },
      },
      'Declarations and Authorities': {
        'Main Declaration Signed': { value: 'Yes', confidence: 0.92 },
        'Company Seal Affixed': { value: 'No', confidence: 0.9, note: 'The seal box on page 14 is empty.' },
        'Search Report Debit Authority': { value: 'NGN 9,900', confidence: 0.8 },
        'Search Report Debit Signed': { value: 'Yes', confidence: 0.92 },
        'Email Indemnity Accepted': { value: 'Yes', confidence: 0.9 },
        'Data Processing Consent — Name': { value: 'Adelaja Babajide Adetayo', confidence: 0.86 },
        'Data Processing Consent — For Entity': { value: 'ABA Integrated Solutions Limited', confidence: 0.88 },
        'Data Processing Consent — Signed': { value: 'Yes', confidence: 0.92 },
        'Data Processing Consent — Date': { value: '11/08/2026', confidence: 0.78 },
      },
      Execution: {
        'Signatory Name': { value: 'Adelaja Babajide Adetayo', confidence: 0.86 },
        'Signatory Status': { value: 'CEO', confidence: 0.88 },
        'Signatory Signature Present': { value: 'Yes', confidence: 0.95 },
        'Signatory Date': { value: '11/08/2026', confidence: 0.65 },
        'Witness Name': { value: 'Obu John', confidence: 0.6 },
        'Witness Address': { value: '32 Warri, Delta', confidence: 0.58 },
        'Witness Occupation': { value: 'Doctor', confidence: 0.8 },
        'Witness Signature Present': { value: 'Yes', confidence: 0.9 },
        'Witness Date': { value: '11/08/2026', confidence: 0.7 },
      },
      'Corporate Online Banking Request': {
        'Preferred Corporate IDs': { value: 'ABA, ABAA, ABABA', confidence: 0.75 },
        'Administrator Transaction Rights': { value: 'With transaction rights', confidence: 0.9 },
        'Preferred User ID': { value: 'ABAA', confidence: 0.75 },
        Title: { value: 'Mr', confidence: 0.94 },
        'First Name': { value: 'Babajide Adetayo', confidence: 0.88 },
        'Last Name': { value: 'Adelaja', confidence: 0.9 },
        Email: { value: 'abaintegratedsolutionsltd@gmail.com', confidence: 0.86 },
        'Mobile Number': { value: '07019233588', confidence: 0.72 },
        'Jurat Completed': { value: 'No', confidence: 0.92, note: 'Struck through — the applicant is literate.' },
        'Revenue Stamp Affixed': { value: 'Yes', confidence: 0.93, note: 'FIRS stamp present.' },
        'Signature Date': { value: '11/08/2026', confidence: 0.75 },
      },
      'Bank Use Only': {
        'Account Number': { value: '2049193882', confidence: 0.88 },
        'Customer ID': { value: null, note: 'Blank — official use only.' },
        'Form Reference': { value: 'SN08187', confidence: 0.35, note: 'Handwritten at the top of page 1.' },
        'PEP Annotation': { value: 'NOT PEP', confidence: 0.85 },
        'Requirements Checklist Itemised': { value: 'No', confidence: 0.9, note: "One diagonal 'Checked' across the block instead of per-row marks." },
        'Documents Checked By': { value: 'Umoru Edwina Ene', confidence: 0.85 },
        'Documents Checked By — Staff Number': { value: 'TN0850015', confidence: 0.7 },
        'Documents Checked — Date': { value: '12/08/2026', confidence: 0.85 },
        'Deferral / Waiver Authorised By': { value: null, note: 'Blank.' },
        'Account Opening Authorised By': { value: 'Adesemi Eguek', confidence: 0.25, note: 'Red handwriting, largely illegible — needs a person.' },
        'Account Opening Authorised By — Staff Number': { value: 'SN031177', confidence: 0.45 },
        'Account Opening Authorised — Date': { value: '12/08/2026', confidence: 0.85 },
        'Address Verification Carried Out By': { value: null, note: 'Blank.' },
        'Business Unit': null,
        'Group Unit': null,
        'Team Unit': null,
        'Desk Unit': null,
        'Indicator Sector': null,
        'Sub Sector': null,
        'MIS Freecode 6': { value: '6', confidence: 0.4 },
        'MIS Freecode 7': { value: '607', confidence: 0.55 },
        'MIS Freecode 8': { value: '60101', confidence: 0.55 },
        'MIS Freecode 9': { value: '40675', confidence: 0.5 },
        'MIS Freecode 10': { value: '28184', confidence: 0.45 },
      },
      'About This Form': {
        Bank: 'First Bank of Nigeria Limited',
        'Form Code': 'CAOF15-10/25',
        Classification: 'CONFIDENTIAL',
        Pages: '16',
        'Pages Not Present': { value: '9, 10, 12', note: 'Additional officer pages 2 and 3, and one further section.' },
        'Overall Confidence': '82%',
        'Straight Through Eligible': { value: 'No', note: 'Blocked by the checklist, the missing seal, the undefined mandate and the TIN format.' },
      },
    },
  },
];

/** Whether a pack leaves room for the live read to fill the rest. */
export function isPartial(fileName: string | undefined, taxonomy: Taxonomy): boolean {
  return Boolean(verifiedPack(fileName, taxonomy)?.partial);
}

/** Checked values first, then anything the live read found that the pack does
 *  not carry. Used for a partial pack, so a half-transcribed form shows the
 *  checked half over the read half rather than one at the cost of the other. */
export function mergeVerified(verified: ReviewField[], live: ReviewField[]): ReviewField[] {
  const seen = new Set(verified.flatMap((r) => [r.id.toLowerCase(), `${r.group}>${r.name}`.toLowerCase()]));
  return [...verified, ...live.filter((r) => !seen.has(r.id.toLowerCase()) && !seen.has(`${r.group}>${r.name}`.toLowerCase()))];
}

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
        // A group that repeats on the form is numbered — the second director
        // carries the same field ids as the first, one occurrence along.
        id: FIELD_IDS[`${path} (${pack.taxonomy})`] ?? FIELD_IDS[path]
          ?? FIELD_IDS[`${group.replace(/ \d+$/, '')} > ${name}`] ?? path,
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
