// ─────────────────────────────────────────────────────────────────────────────
// Checked, MASKED transcriptions of the sample packages: the two FirstBank packages
// the Stanbic IBTC entity form (s.pdf) and the FirstBank corporate form
// (AOF Corporate.PDF), and the FirstBank individual form (AOF Individual.PDF).
//
// The package flow (src/integrations/packageDocs.ts) matches an uploaded file by
// its SHA-256 and, for these files only, takes its fields from here — the AOFs
// and mandate cards are handwritten scans no browser can read reliably. Every
// identifier is masked (BVN, NIN, phones, TIN, BN/RC, account and staff numbers:
// first 3 digits kept, the rest transformed; e-mails as demo.<name>@…). Names,
// dates, streets and towns are as written, so the extraction visibly matches the
// page. Generated from the reviewed transcription — do not hand-edit values.
// ─────────────────────────────────────────────────────────────────────────────
// Also the Stanbic IBTC KYC package for FIRSCS COLLECTION SERVICES (package
// "stanbic-firscs": the bank's 91-page KYC PDF split into its documents, in
// Package 1/KYC - General Search/{Inputs,Outputs}) — same masking.
import type { PackageDocType } from '../integrations/packageDocs';

export interface PackageReads {
  packages: Record<string, { kind: 'individual' | 'business'; formRows: { group: string; name: string; value: string; confidence: number }[] }>;
  files: Record<string, { package: string; type: PackageDocType; summary: string; fields: { name: string; value: string }[] }>;
}

export const PACKAGE_READS: PackageReads = {
 "packages": {
  "package1": {
   "kind": "individual",
   "formRows": [
    {
     "group": "Personal Details",
     "name": "Title",
     "value": "Miss",
     "confidence": 95
    },
    {
     "group": "Personal Details",
     "name": "Surname",
     "value": "Liasu",
     "confidence": 95
    },
    {
     "group": "Personal Details",
     "name": "First Name",
     "value": "Zainab",
     "confidence": 96
    },
    {
     "group": "Personal Details",
     "name": "Other Names",
     "value": "Morenikeji",
     "confidence": 90
    },
    {
     "group": "Personal Details",
     "name": "Mother's Maiden Name",
     "value": "Fausat",
     "confidence": 85
    },
    {
     "group": "Personal Details",
     "name": "Gender",
     "value": "Female",
     "confidence": 95
    },
    {
     "group": "Personal Details",
     "name": "Marital Status",
     "value": "Single",
     "confidence": 95
    },
    {
     "group": "Personal Details",
     "name": "Date of Birth",
     "value": "13/04/2001",
     "confidence": 94
    },
    {
     "group": "Personal Details",
     "name": "Nationality",
     "value": "Nigerian",
     "confidence": 88
    },
    {
     "group": "Personal Details",
     "name": "State of Origin",
     "value": "Kwara",
     "confidence": 88
    },
    {
     "group": "Contact Details",
     "name": "House Number",
     "value": "24",
     "confidence": 95
    },
    {
     "group": "Contact Details",
     "name": "Street Name",
     "value": "Italagba Housing",
     "confidence": 80
    },
    {
     "group": "Contact Details",
     "name": "City/Town",
     "value": "Lagos Island",
     "confidence": 92
    },
    {
     "group": "Contact Details",
     "name": "State",
     "value": "Lagos",
     "confidence": 95
    },
    {
     "group": "Contact Details",
     "name": "LGA",
     "value": "Lagos Island",
     "confidence": 85
    },
    {
     "group": "Contact Details",
     "name": "Phone Number 1",
     "value": "09078616944",
     "confidence": 92
    },
    {
     "group": "Identification",
     "name": "BVN",
     "value": "22533092864",
     "confidence": 94
    },
    {
     "group": "Identification",
     "name": "NIN",
     "value": "50775447946",
     "confidence": 93
    },
    {
     "group": "Identification",
     "name": "ID Type",
     "value": "National ID Card",
     "confidence": 96
    },
    {
     "group": "Identification",
     "name": "ID Number",
     "value": "50775447946",
     "confidence": 93
    },
    {
     "group": "Employment",
     "name": "Employment Status",
     "value": "Self Employed",
     "confidence": 95
    },
    {
     "group": "Employment",
     "name": "Occupation",
     "value": "Sales of hair",
     "confidence": 88
    },
    {
     "group": "Employment",
     "name": "Employer Name",
     "value": "Zainab Liasu Morenikeji",
     "confidence": 85
    },
    {
     "group": "Employment",
     "name": "Salary",
     "value": "N5million - Less than N10million",
     "confidence": 90
    },
    {
     "group": "Account Setup",
     "name": "Branch",
     "value": "Marina",
     "confidence": 90
    },
    {
     "group": "Account Setup",
     "name": "Account Type",
     "value": "Individual Account - Savings",
     "confidence": 92
    },
    {
     "group": "Account Setup",
     "name": "Purpose of Account",
     "value": "Savings",
     "confidence": 88
    },
    {
     "group": "Next of Kin",
     "name": "Surname",
     "value": "Liasu",
     "confidence": 90
    },
    {
     "group": "Next of Kin",
     "name": "First Name",
     "value": "Fareedat",
     "confidence": 75
    },
    {
     "group": "Next of Kin",
     "name": "Relationship",
     "value": "Sister",
     "confidence": 92
    },
    {
     "group": "Next of Kin",
     "name": "Mobile Number",
     "value": "09107025744",
     "confidence": 85
    },
    {
     "group": "Next of Kin",
     "name": "House Number",
     "value": "24",
     "confidence": 88
    },
    {
     "group": "Next of Kin",
     "name": "Street Name",
     "value": "Italagba Housing",
     "confidence": 78
    }
   ]
  },
  "package2": {
   "kind": "business",
   "formRows": [
    {
     "group": "Company details",
     "name": "Business Name",
     "value": "ACO SWIFT LOGISTICS",
     "confidence": 96
    },
    {
     "group": "Company details",
     "name": "RC / Registration Number",
     "value": "BN3157805",
     "confidence": 92
    },
    {
     "group": "Company details",
     "name": "TIN",
     "value": "2627186376208",
     "confidence": 88
    },
    {
     "group": "Company details",
     "name": "Business Category",
     "value": "Business Name / Sole Proprietor",
     "confidence": 92
    },
    {
     "group": "Company details",
     "name": "Nature of Business",
     "value": "LOGISTICS",
     "confidence": 95
    },
    {
     "group": "Company details",
     "name": "Sector/Industry",
     "value": "TRANSPORT",
     "confidence": 85
    },
    {
     "group": "Company details",
     "name": "Annual Turnover",
     "value": "Below 50Million",
     "confidence": 95
    },
    {
     "group": "Company details",
     "name": "Operating Business Address",
     "value": "JOKIT PLAZA, 8, OLD OLOWO IRA ROAD, ISHERI, BERGER, LAGOS",
     "confidence": 85
    },
    {
     "group": "Company details",
     "name": "Email",
     "value": "demo.olajide@gmail.com",
     "confidence": 85
    },
    {
     "group": "Company details",
     "name": "Phone Number 1",
     "value": "08071343948",
     "confidence": 90
    },
    {
     "group": "Company details",
     "name": "Date of Registration",
     "value": "06/08/2020",
     "confidence": 93
    },
    {
     "group": "Directors / signatories 1",
     "name": "Full Name",
     "value": "AFOLAYAN OLAJIDE OLUWADARE",
     "confidence": 94
    },
    {
     "group": "Directors / signatories 1",
     "name": "BVN",
     "value": "22196593360",
     "confidence": 90
    },
    {
     "group": "Directors / signatories 1",
     "name": "Means of Identification",
     "value": "National ID Card",
     "confidence": 93
    },
    {
     "group": "Directors / signatories 1",
     "name": "ID Number",
     "value": "49269893980",
     "confidence": 90
    },
    {
     "group": "Directors / signatories 1",
     "name": "Phone",
     "value": "08071343948",
     "confidence": 90
    },
    {
     "group": "Directors / signatories 1",
     "name": "Email",
     "value": "demo.olajide@gmail.com",
     "confidence": 85
    },
    {
     "group": "Directors / signatories 1",
     "name": "Designation",
     "value": "CEO",
     "confidence": 93
    }
   ]
  },
  "stanbic-entity": {
   "kind": "business",
   "formRows": [
    {
     "group": "Company details",
     "name": "Business Name",
     "value": "GEORGE EMORE TECHNICAL ENTERPRISES LTD",
     "confidence": 90
    },
    {
     "group": "Company details",
     "name": "RC / Registration Number",
     "value": "961904",
     "confidence": 88
    },
    {
     "group": "Company details",
     "name": "TIN",
     "value": "26271929944026",
     "confidence": 86
    },
    {
     "group": "Company details",
     "name": "Business Category",
     "value": "Limited Liability Company",
     "confidence": 96
    },
    {
     "group": "Company details",
     "name": "Nature of Business",
     "value": "CONSULTANCY IN INFOTECH",
     "confidence": 84
    },
    {
     "group": "Company details",
     "name": "Sector/Industry",
     "value": "INFORMATION TECHNOLOGY",
     "confidence": 85
    },
    {
     "group": "Company details",
     "name": "Annual Turnover",
     "value": "Less than N400m",
     "confidence": 95
    },
    {
     "group": "Company details",
     "name": "Operating Business Address",
     "value": "45, AJOSE STREET, MENDE, MARYLAND, LAGOS",
     "confidence": 80
    },
    {
     "group": "Company details",
     "name": "Email",
     "value": "demo.efe@gmail.com",
     "confidence": 86
    },
    {
     "group": "Company details",
     "name": "Phone Number 1",
     "value": "08072402996",
     "confidence": 90
    },
    {
     "group": "Company details",
     "name": "Date of Registration",
     "value": "17/06/2026",
     "confidence": 92
    },
    {
     "group": "Directors / signatories 1",
     "name": "Full Name",
     "value": "EMORE EFE GEORGE",
     "confidence": 93
    },
    {
     "group": "Directors / signatories 1",
     "name": "BVN",
     "value": "22114800154",
     "confidence": 78
    },
    {
     "group": "Directors / signatories 1",
     "name": "Means of Identification",
     "value": "International Passport",
     "confidence": 98
    },
    {
     "group": "Directors / signatories 1",
     "name": "ID Number",
     "value": "B03166085",
     "confidence": 97
    },
    {
     "group": "Directors / signatories 1",
     "name": "Phone",
     "value": "08072402996",
     "confidence": 91
    },
    {
     "group": "Directors / signatories 1",
     "name": "Email",
     "value": "demo.efe@gmail.com",
     "confidence": 80
    },
    {
     "group": "Directors / signatories 1",
     "name": "Designation",
     "value": "Director",
     "confidence": 94
    },
    {
     "group": "Directors / signatories 2",
     "name": "Full Name",
     "value": "AKERELE KEHINDE OMOTAYO",
     "confidence": 92
    },
    {
     "group": "Directors / signatories 2",
     "name": "BVN",
     "value": "22111930423",
     "confidence": 88
    },
    {
     "group": "Directors / signatories 2",
     "name": "Means of Identification",
     "value": "International Passport",
     "confidence": 98
    },
    {
     "group": "Directors / signatories 2",
     "name": "ID Number",
     "value": "B00562479",
     "confidence": 97
    },
    {
     "group": "Directors / signatories 2",
     "name": "Phone",
     "value": "08055875572",
     "confidence": 90
    },
    {
     "group": "Directors / signatories 2",
     "name": "Email",
     "value": "demo.kehinde@yahoo.com",
     "confidence": 82
    },
    {
     "group": "Directors / signatories 2",
     "name": "Designation",
     "value": "Director",
     "confidence": 94
    }
   ]
  },
  "firstbank-corporate": {
   "kind": "business",
   "formRows": [
    {
     "group": "Company details",
     "name": "Business Name",
     "value": "ABA INTEGRATED SOLUTIONS LIMITED",
     "confidence": 94
    },
    {
     "group": "Company details",
     "name": "RC / Registration Number",
     "value": "9740483",
     "confidence": 90
    },
    {
     "group": "Company details",
     "name": "TIN",
     "value": "26242217379523",
     "confidence": 64
    },
    {
     "group": "Company details",
     "name": "Business Category",
     "value": "Limited Liability Company",
     "confidence": 96
    },
    {
     "group": "Company details",
     "name": "Nature of Business",
     "value": "INFORMATION TECHNOLOGY",
     "confidence": 92
    },
    {
     "group": "Company details",
     "name": "Sector/Industry",
     "value": "INFORMATION TECHNOLOGY",
     "confidence": 92
    },
    {
     "group": "Company details",
     "name": "Annual Turnover",
     "value": "Below 50 Million",
     "confidence": 95
    },
    {
     "group": "Company details",
     "name": "Operating Business Address",
     "value": "18 OBAFEMI AWOLOWO STREET, LUGBE, ABUJA - FCT",
     "confidence": 88
    },
    {
     "group": "Company details",
     "name": "Email",
     "value": "demo.babajide@gmail.com",
     "confidence": 90
    },
    {
     "group": "Company details",
     "name": "Phone Number 1",
     "value": "07006744899",
     "confidence": 80
    },
    {
     "group": "Company details",
     "name": "Date of Registration",
     "value": "04/08/2026",
     "confidence": 80
    },
    {
     "group": "Company details",
     "name": "Jurisdiction",
     "value": "ABUJA",
     "confidence": 92
    },
    {
     "group": "Directors / signatories 1",
     "name": "Full Name",
     "value": "ADELAJA BABAJIDE ADETAYO",
     "confidence": 94
    },
    {
     "group": "Directors / signatories 1",
     "name": "BVN",
     "value": "22476998209",
     "confidence": 80
    },
    {
     "group": "Directors / signatories 1",
     "name": "Means of Identification",
     "value": "National ID card",
     "confidence": 95
    },
    {
     "group": "Directors / signatories 1",
     "name": "ID Number",
     "value": "82041948706",
     "confidence": 92
    },
    {
     "group": "Directors / signatories 1",
     "name": "Phone",
     "value": "07006744899",
     "confidence": 80
    },
    {
     "group": "Directors / signatories 1",
     "name": "Email",
     "value": "demo.babajide@gmail.com",
     "confidence": 88
    },
    {
     "group": "Directors / signatories 1",
     "name": "Designation",
     "value": "Director",
     "confidence": 95
    },
    {
     "group": "Directors / signatories 1",
     "name": "Date of Birth",
     "value": "06/10/1984",
     "confidence": 92
    },
    {
     "group": "Directors / signatories 1",
     "name": "Gender",
     "value": "Male",
     "confidence": 95
    },
    {
     "group": "Directors / signatories 1",
     "name": "Occupation",
     "value": "ACCOUNTANT",
     "confidence": 92
    },
    {
     "group": "Directors / signatories 1",
     "name": "Roles",
     "value": "Signatory, Ultimate Beneficial Owner, Director",
     "confidence": 95
    }
   ]
  },
  "firstbank-individual": {
   "kind": "individual",
   "formRows": [
    {
     "group": "Personal Details",
     "name": "Title",
     "value": "Mr",
     "confidence": 95
    },
    {
     "group": "Personal Details",
     "name": "Surname",
     "value": "DADA",
     "confidence": 95
    },
    {
     "group": "Personal Details",
     "name": "First Name",
     "value": "OLUMUYIWA",
     "confidence": 94
    },
    {
     "group": "Personal Details",
     "name": "Other Names",
     "value": "OLUWAFEMI",
     "confidence": 93
    },
    {
     "group": "Personal Details",
     "name": "Mother's Maiden Name",
     "value": "BAKRE",
     "confidence": 80
    },
    {
     "group": "Personal Details",
     "name": "Gender",
     "value": "Male",
     "confidence": 95
    },
    {
     "group": "Personal Details",
     "name": "Marital Status",
     "value": "Single",
     "confidence": 95
    },
    {
     "group": "Personal Details",
     "name": "Date of Birth",
     "value": "02/12/1992",
     "confidence": 93
    },
    {
     "group": "Personal Details",
     "name": "Place of Birth",
     "value": "IKEJA",
     "confidence": 92
    },
    {
     "group": "Personal Details",
     "name": "Nationality",
     "value": "Nigerian",
     "confidence": 94
    },
    {
     "group": "Personal Details",
     "name": "State of Origin",
     "value": "LAGOS",
     "confidence": 93
    },
    {
     "group": "Personal Details",
     "name": "LGA of Origin",
     "value": "ALIMOSHO",
     "confidence": 90
    },
    {
     "group": "Contact Details",
     "name": "House Number",
     "value": "4",
     "confidence": 94
    },
    {
     "group": "Contact Details",
     "name": "Street Name",
     "value": "TINUBU STREET",
     "confidence": 92
    },
    {
     "group": "Contact Details",
     "name": "Area",
     "value": "ALAPERE, KETU",
     "confidence": 90
    },
    {
     "group": "Contact Details",
     "name": "City/Town",
     "value": "LAGOS",
     "confidence": 94
    },
    {
     "group": "Contact Details",
     "name": "State",
     "value": "LAGOS",
     "confidence": 94
    },
    {
     "group": "Contact Details",
     "name": "LGA",
     "value": "KOSOFE",
     "confidence": 91
    },
    {
     "group": "Contact Details",
     "name": "Nearest Bus Stop",
     "value": "KETU",
     "confidence": 90
    },
    {
     "group": "Contact Details",
     "name": "Phone Number 1",
     "value": "08126040258",
     "confidence": 96
    },
    {
     "group": "Contact Details",
     "name": "Email",
     "value": "demo.olumuyiwa@gmail.com",
     "confidence": 80
    },
    {
     "group": "Identification",
     "name": "BVN",
     "value": "22303594107",
     "confidence": 80
    },
    {
     "group": "Identification",
     "name": "NIN",
     "value": "57076619354",
     "confidence": 80
    },
    {
     "group": "Identification",
     "name": "ID Type",
     "value": "National ID card",
     "confidence": 95
    },
    {
     "group": "Identification",
     "name": "ID Number",
     "value": "57076619354",
     "confidence": 80
    },
    {
     "group": "Identification",
     "name": "ID Issue Date",
     "value": "23/??/2024",
     "confidence": 64
    },
    {
     "group": "Employment",
     "name": "Employment Status",
     "value": "Employed",
     "confidence": 95
    },
    {
     "group": "Employment",
     "name": "Date of Employment",
     "value": "19/11/2018",
     "confidence": 96
    },
    {
     "group": "Employment",
     "name": "Occupation",
     "value": "CIVIL SERVANT / INFORMATION OFFICER",
     "confidence": 90
    },
    {
     "group": "Employment",
     "name": "Employer Name",
     "value": "LAGOS STATE GOVERNMENT",
     "confidence": 94
    },
    {
     "group": "Employment",
     "name": "Salary",
     "value": "N51,000 - N250,000",
     "confidence": 93
    },
    {
     "group": "Employment",
     "name": "Employer Address",
     "value": "ALAUSA SECRETARIAT, IKEJA, LAGOS",
     "confidence": 88
    },
    {
     "group": "Account Setup",
     "name": "Branch",
     "value": "ALAPERE",
     "confidence": 92
    },
    {
     "group": "Account Setup",
     "name": "Account Type",
     "value": "Current account",
     "confidence": 80
    },
    {
     "group": "Account Setup",
     "name": "Purpose of Account",
     "value": "SAVINGS",
     "confidence": 90
    },
    {
     "group": "Next of Kin",
     "name": "Surname",
     "value": "DADA",
     "confidence": 90
    },
    {
     "group": "Next of Kin",
     "name": "First Name",
     "value": "OLUWAKEMI",
     "confidence": 96
    },
    {
     "group": "Next of Kin",
     "name": "Relationship",
     "value": "Sister",
     "confidence": 94
    },
    {
     "group": "Next of Kin",
     "name": "Date of Birth",
     "value": "31/05/1977",
     "confidence": 80
    },
    {
     "group": "Next of Kin",
     "name": "Gender",
     "value": "Female",
     "confidence": 95
    },
    {
     "group": "Next of Kin",
     "name": "Mobile Number",
     "value": "08053664513",
     "confidence": 80
    },
    {
     "group": "Next of Kin",
     "name": "House Number",
     "value": "4B",
     "confidence": 90
    },
    {
     "group": "Next of Kin",
     "name": "Street Name",
     "value": "TINUBU STREET",
     "confidence": 90
    },
    {
     "group": "Next of Kin",
     "name": "Email",
     "value": "demo.oluwakemi@gmail.com",
     "confidence": 80
    }
   ]
  },
  "stanbic-firscs": {
   "kind": "business",
   "formRows": [
    {
     "group": "Company details",
     "name": "Business Name",
     "value": "FIRSCS COLLECTION SERVICES",
     "confidence": 96
    },
    {
     "group": "Company details",
     "name": "RC / Registration Number",
     "value": "7993220",
     "confidence": 92
    },
    {
     "group": "Company details",
     "name": "TIN",
     "value": "1086565686",
     "confidence": 88
    },
    {
     "group": "Company details",
     "name": "Business Category",
     "value": "Sole Proprietor",
     "confidence": 95
    },
    {
     "group": "Company details",
     "name": "Account Type",
     "value": "Biz Smart",
     "confidence": 94
    },
    {
     "group": "Company details",
     "name": "Nature of Business",
     "value": "SALES AND SUPPLY OF CLOTHS",
     "confidence": 88
    },
    {
     "group": "Company details",
     "name": "Sector/Industry",
     "value": "TEXTILE MANUFACTURING, GENERAL CONTRACTS, GENERAL MERCHANDISE",
     "confidence": 84
    },
    {
     "group": "Company details",
     "name": "Annual Turnover",
     "value": "Less than ₦400m",
     "confidence": 95
    },
    {
     "group": "Company details",
     "name": "Operating Business Address",
     "value": "ALH SANUSI MUSA KAURA RESIDENCE, T/WADA AREA, GUSAU",
     "confidence": 82
    },
    {
     "group": "Company details",
     "name": "Email",
     "value": "demo.sanusi@gmail.com",
     "confidence": 86
    },
    {
     "group": "Company details",
     "name": "Phone Number 1",
     "value": "08075040901",
     "confidence": 90
    },
    {
     "group": "Company details",
     "name": "Date of Registration",
     "value": "09/10/2024",
     "confidence": 92
    },
    {
     "group": "Directors / signatories 1",
     "name": "Full Name",
     "value": "MUSA SANUSI KAURA",
     "confidence": 94
    },
    {
     "group": "Directors / signatories 1",
     "name": "BVN",
     "value": "22238737600",
     "confidence": 90
    },
    {
     "group": "Directors / signatories 1",
     "name": "Means of Identification",
     "value": "National ID Card",
     "confidence": 95
    },
    {
     "group": "Directors / signatories 1",
     "name": "ID Number",
     "value": "60330692712",
     "confidence": 86
    },
    {
     "group": "Directors / signatories 1",
     "name": "Phone",
     "value": "08075040901",
     "confidence": 91
    },
    {
     "group": "Directors / signatories 1",
     "name": "Email",
     "value": "demo.sanusi@gmail.com",
     "confidence": 84
    },
    {
     "group": "Directors / signatories 1",
     "name": "Designation",
     "value": "Managing Director",
     "confidence": 93
    },
    {
     "group": "Directors / signatories 1",
     "name": "Date of Birth",
     "value": "06/02/1980",
     "confidence": 90
    },
    {
     "group": "Directors / signatories 1",
     "name": "Gender",
     "value": "Male",
     "confidence": 95
    },
    {
     "group": "Directors / signatories 1",
     "name": "Occupation",
     "value": "BUSINESS",
     "confidence": 92
    },
    {
     "group": "Directors / signatories 1",
     "name": "Roles",
     "value": "Sole signatory, Proprietor",
     "confidence": 93
    }
   ]
  }
 },
 "files": {
  "12837b3204bb3edc6c7d6a83f638d8a5653d813928ccba7080e49fddbaa7fe2d": {
   "package": "package1",
   "type": "aof-page",
   "summary": "Re-submitted page 2 of the individual AOF; the only change is that Annual Salary is now ticked (N5million - Less than N10million).",
   "fields": [
    {
     "name": "Changed field",
     "value": "Annual Salary / Expected Annual Income"
    },
    {
     "name": "Original value",
     "value": "Blank"
    },
    {
     "name": "Amended value",
     "value": "N5million - Less than N10million"
    },
    {
     "name": "Unchanged",
     "value": "National ID 50775447946, Self Employed, Sales of hair, NOK Liasu Fareedat (Sister) 09107025744"
    }
   ]
  },
  "cdd36a0b091ef98de2160db205d0dba8f6420c9550247e375373d55a0f5529a2": {
   "package": "package1",
   "type": "aof",
   "summary": "9-page FirstBank individual account opening form for Zainab Morenikeji Liasu (savings, Marina branch), signed 05/08/2026, with requirements checklist signed off 06/08/2026; annual salary left blank.",
   "fields": [
    {
     "name": "Form",
     "value": "Application to Open an Individual Account"
    },
    {
     "name": "Branch",
     "value": "Marina"
    },
    {
     "name": "Account Category / Type",
     "value": "Individual Account; Savings"
    },
    {
     "name": "BVN",
     "value": "22533092864"
    },
    {
     "name": "NIN",
     "value": "50775447946"
    },
    {
     "name": "Name",
     "value": "Miss Liasu Zainab Morenikeji"
    },
    {
     "name": "Mother's Maiden Name",
     "value": "Fausat"
    },
    {
     "name": "Date of Birth",
     "value": "13/04/2001"
    },
    {
     "name": "Place of Birth",
     "value": "Lagos"
    },
    {
     "name": "State of Origin / LGA",
     "value": "Kwara / Ifelodun"
    },
    {
     "name": "Address",
     "value": "24 Italagba Housing, near Central Mosque, Lagos Island, Lagos"
    },
    {
     "name": "Phone Number 1",
     "value": "09078616944"
    },
    {
     "name": "Email",
     "value": "N/A"
    },
    {
     "name": "Services",
     "value": "Mobile Banking, Internet Banking, SMS and Email alerts, Naira Debit Card"
    },
    {
     "name": "Means of ID",
     "value": "National ID Card, ID No. 50775447946 (no issue/expiry date)"
    },
    {
     "name": "Employment",
     "value": "Self Employed; Sales of hair; employer Zainab Liasu Morenikeji, 24 Italagba Housing, Lagos Island"
    },
    {
     "name": "Annual Salary",
     "value": "Not ticked on original (see AMENDED_AOF)"
    },
    {
     "name": "Next of Kin",
     "value": "Liasu Fareedat, Sister, DOB 06/03/2007, F, mobile 09107025744, 24 Italagba Housing, Lagos Island"
    },
    {
     "name": "Declaration",
     "value": "Signed Zainab with N50 FIRS stamp, dated 05/08/2026"
    },
    {
     "name": "Checklist",
     "value": "Items 1-5 (photo, ID, consent, BVN/NIN, proof of address) Yes/Checked; PEP: No"
    },
    {
     "name": "Document checked by (HNFT)",
     "value": "Amarachi (surname partly illegible), staff TN032817, 06/08/2026"
    },
    {
     "name": "Account opening authorised by (HBS)",
     "value": "Ifeoluwa Oso, staff SN034189, 06/08/2026"
    }
   ]
  },
  "6bc2351538f227a79ca1dd0b97292b909ca2b1f22e50d1fd3ee9f8441fc82980": {
   "package": "package1",
   "type": "avr",
   "summary": "Address verification report confirming Zainab Morenikeji Liasu resides at 24 Italagba Housing, Lagos Island, verified 05/08/2026.",
   "fields": [
    {
     "name": "Applicant's Name",
     "value": "Zainab Morenikeji Liasu"
    },
    {
     "name": "Address",
     "value": "24, Italagba Housing"
    },
    {
     "name": "Town / State",
     "value": "Lagos Island / Lagos"
    },
    {
     "name": "Date of Verification",
     "value": "05/08/2026"
    },
    {
     "name": "Residing at stated address",
     "value": "Yes"
    },
    {
     "name": "Identifier confirmed existence",
     "value": "Yes"
    },
    {
     "name": "Landmark",
     "value": "Central Mosque"
    },
    {
     "name": "House description",
     "value": "There is a cream mosque adjacent the house, the house is painted brown."
    },
    {
     "name": "RM",
     "value": "Adesina A. Alausa, staff SN035359"
    }
   ]
  },
  "5ed15413ba25b2093fd5f9550c5e0c66e0fa35a1ed8f0aac6bf586c3d1c3a8be": {
   "package": "package1",
   "type": "bvn-api",
   "summary": "BVN API printout (text layer) for Zainab Morenikeji Liasu with photo; not watchlisted.",
   "fields": [
    {
     "name": "BVN Number",
     "value": "22533092864"
    },
    {
     "name": "First Name",
     "value": "ZAINAB"
    },
    {
     "name": "Last Name",
     "value": "LIASU"
    },
    {
     "name": "Middle Name",
     "value": "MORENIKEJI"
    },
    {
     "name": "Date of Birth",
     "value": "13-Apr-2001"
    },
    {
     "name": "Mobile",
     "value": "2349078616944"
    },
    {
     "name": "Gender",
     "value": "Female"
    },
    {
     "name": "Marital Status",
     "value": "Single"
    },
    {
     "name": "BVN Watchlisted",
     "value": "NO"
    }
   ]
  },
  "a4422474c68b151e8c9cc6a4d1519bc6b83001754c1d09514d453b6606afd744": {
   "package": "package1",
   "type": "bvn-portal",
   "summary": "Scanned BVN Validation Portal result for Zainab Morenikeji Liasu, searched 05-08-2026, stamped by Team Lead Financial Transaction, Marina.",
   "fields": [
    {
     "name": "BVN",
     "value": "22533092864"
    },
    {
     "name": "Registration Date",
     "value": "14-Nov-18"
    },
    {
     "name": "First Name",
     "value": "ZAINAB"
    },
    {
     "name": "Middle Name",
     "value": "MORENIKEJI"
    },
    {
     "name": "Last Name",
     "value": "LIASU"
    },
    {
     "name": "Birth Date",
     "value": "13-Apr-2001"
    },
    {
     "name": "Phone",
     "value": "2349078616944"
    },
    {
     "name": "NIN",
     "value": "(blank)"
    },
    {
     "name": "Enrollment Branch",
     "value": "0109-Idumota 3"
    },
    {
     "name": "Enrollment Institution",
     "value": "UBA"
    },
    {
     "name": "Searched",
     "value": "05-08-2026 7:39:45 AM by demo.adesina@firstbanknigeria.com"
    }
   ]
  },
  "8afa9f5ddfc3bc3e016911e5271ddf5b1324425e0aa4c068156053416fda6399": {
   "package": "package1",
   "type": "nin-lookup",
   "summary": "Verify Customer NIN screen for Zainab Morenikeji Liasu, checked 05 Aug 2026, stamped Team Lead Financial Transaction.",
   "fields": [
    {
     "name": "NIN",
     "value": "50775447946"
    },
    {
     "name": "First Name",
     "value": "ZAINAB"
    },
    {
     "name": "Last Name",
     "value": "LIASU"
    },
    {
     "name": "Middle Name",
     "value": "MORENIKEJI"
    },
    {
     "name": "Phone Number",
     "value": "09078616944"
    },
    {
     "name": "Address",
     "value": "BLOCK 2 FLAT 2 ITA ALAGBA HOUSING ESTATE"
    },
    {
     "name": "Checked By",
     "value": "SN035359"
    },
    {
     "name": "Date Checked",
     "value": "Wed Aug 05 2026 07:38:37 GMT+0100 (West Africa Time)"
    },
    {
     "name": "Gender",
     "value": "f"
    },
    {
     "name": "Date of Birth",
     "value": "13-04-2001"
    },
    {
     "name": "Email",
     "value": "(blank)"
    }
   ]
  },
  "da0316d2161294acd7a161f431e185e19a259a0ac290ac777caecb0b326a30c6": {
   "package": "package1",
   "type": "mandate",
   "summary": "Individual account mandate card: savings account, sole signatory Liasu Zainab Morenikeji with passport photo, dated 05/08/2026.",
   "fields": [
    {
     "name": "Account Type",
     "value": "Savings"
    },
    {
     "name": "Account Name",
     "value": "Zainab Morenikeji Liasu"
    },
    {
     "name": "Mandate Rule",
     "value": "Sole Signatory"
    },
    {
     "name": "Signatory",
     "value": "Liasu Zainab Morenikeji"
    },
    {
     "name": "ID Type",
     "value": "National ID"
    },
    {
     "name": "ID Number",
     "value": "50775447946"
    },
    {
     "name": "Signature",
     "value": "Zainab (signed)"
    },
    {
     "name": "Date",
     "value": "05/08/2026"
    },
    {
     "name": "Additional Signatory",
     "value": "None"
    },
    {
     "name": "Authorising Officer",
     "value": "Ifeoluwa Oso, SN034189, 06/08/2026"
    }
   ]
  },
  "6df08097589c6d411df06f805ed36bb119880b2b91896a177d73dfe5854b53a9": {
   "package": "package1",
   "type": "nin-api",
   "summary": "NIMC API printout (text layer) for Zainab Morenikeji Liasu with photo; NIN not blacklisted.",
   "fields": [
    {
     "name": "National ID No",
     "value": "50775447946"
    },
    {
     "name": "First Name",
     "value": "ZAINAB"
    },
    {
     "name": "Last Name",
     "value": "LIASU"
    },
    {
     "name": "Middle Name",
     "value": "MORENIKEJI"
    },
    {
     "name": "Date of Birth",
     "value": "13-04-2001"
    },
    {
     "name": "Mobile",
     "value": "09078616944"
    },
    {
     "name": "Gender",
     "value": "FEMALE"
    },
    {
     "name": "Nin Blacklisted",
     "value": "NO"
    }
   ]
  },
  "a64d4dcbe9c59eefe79afe040f901e7d9bbac304ba8ab5cd4dd80a6d2dda88d0": {
   "package": "package1",
   "type": "others-printout",
   "summary": "Alert-profiler screen 'View Customer Accounts by Mobile Number' showing no existing FirstBank accounts tied to the applicant's mobile number (new-to-bank check).",
   "fields": [
    {
     "name": "Mobile Number searched",
     "value": "09078616944 (+234 - Nigeria)"
    },
    {
     "name": "Message",
     "value": "The mobile number 2349078616944 has not been enrolled for SMS or Email alert"
    },
    {
     "name": "Result",
     "value": "No data available in table (0 accounts)"
    },
    {
     "name": "Stamps",
     "value": "Team Lead Financial Transaction, Marina Branch; initialled by Ifeoluwa Oso SN034189"
    }
   ]
  },
  "e5866c23e8e2726d6184b6bd15fba7e3f7f4906fcca5141ed36388f99a05cf88": {
   "package": "package2",
   "type": "aof",
   "summary": "15-page FirstBank entity account opening form (business name / sole proprietor) for ACO SWIFT LOGISTICS, Marina branch, SME Classic, signed by Afolayan Olajide Oluwadare (CEO) on 07/08/2026.",
   "fields": [
    {
     "name": "Branch",
     "value": "MARINA"
    },
    {
     "name": "Annotations",
     "value": "NOT A PEP; SH030074-RM; SME Classic"
    },
    {
     "name": "Account No. / Customer ID",
     "value": "2046067974 / 230804956"
    },
    {
     "name": "BVN / NIN",
     "value": "22196593360 / 49269893980"
    },
    {
     "name": "Business Category",
     "value": "Business Name; Sole Proprietor"
    },
    {
     "name": "Company/Business Name",
     "value": "ACO SWIFT LOGISTICS"
    },
    {
     "name": "Certificate of Registration",
     "value": "BN3157805"
    },
    {
     "name": "Date of Registration",
     "value": "06/08/2020"
    },
    {
     "name": "Type/Nature of Business",
     "value": "LOGISTICS"
    },
    {
     "name": "Sector/Industry",
     "value": "TRANSPORT"
    },
    {
     "name": "Operating Business Address",
     "value": "JOKIT PLAZA, 8, OLD OLOWO IRA ROAD, ISHERI, BERGER, LAGOS."
    },
    {
     "name": "Email / Phone 1",
     "value": "demo.olajide@gmail.com / 08071343948"
    },
    {
     "name": "TIN",
     "value": "2627186376208"
    },
    {
     "name": "Annual Turnover",
     "value": "Below 50Million; not quoted on a stock exchange"
    },
    {
     "name": "Other bank accounts / affiliated companies",
     "value": "N/A"
    },
    {
     "name": "Online banking",
     "value": "Corporate IDs ACOSWIFT / ACOS / ACOST; admin with transaction right, user ID DEMO.OLAJIDE (masked), Mr Olajide Afolayan, mobile 08071343948"
    },
    {
     "name": "Sole proprietor",
     "value": "Mr Afolayan Olajide Oluwadare, DOB 03/05/1986, M, Married ticked, born Ekiti, Nigerian, State of Origin Ekiti, LGA Ijero"
    },
    {
     "name": "Proprietor address",
     "value": "9 Olatude Sule Street, Olowora, Berger, Ikeja LGA, Lagos"
    },
    {
     "name": "Proprietor ID",
     "value": "National ID Card 49269893980"
    },
    {
     "name": "Next of Kin",
     "value": "Mr Afolayan John Aina, Father, DOB 01/01/1953, 9 Olatude Sule Street, Olowora, Berger, Ikeja, Lagos, 08071343948 / 08025991140"
    },
    {
     "name": "Director 1",
     "value": "Mr Afolayan Olajide Oluwadare, BVN 22196593360, Mother's maiden name Omodara, Logistics, CEO"
    },
    {
     "name": "Account signatory 1",
     "value": "Afolayan Olajide Oluwadare, Class A, signed 07/08/2026; signatory 2 struck N/A"
    },
    {
     "name": "Declaration",
     "value": "Signed with N50 FIRS stamp, 07/08/2026"
    },
    {
     "name": "Signed in the presence of",
     "value": "Afolayan John, 9 Olatude Sule Street, Olowora, Berger, Lagos; Business man / Retiree; 07/08/2026"
    },
    {
     "name": "Checklist",
     "value": "Items 1-8, 11a, 13, 14 Yes/Checked; HNFT Amarachi (surname partly illegible) TN032817 08/08/2026; HBS Ifeoluwa Oso SN034189 08/08/2026"
    },
    {
     "name": "FATCA/CRS supplement",
     "value": "ACO SWIFT LOGISTICS, residence and birth Nigeria, No to all US/OECD questions, signed 07-08-2026"
    }
   ]
  },
  "80411710309098cfb22674ba912c8a4c155e3f8ca7b796d1f3a7f1fdb1fdc8c9": {
   "package": "package2",
   "type": "aof-page",
   "summary": "Separate rescan of the AOF requirements checklist and sign-off page (page 12); same content as in the PDF.",
   "fields": [
    {
     "name": "Ticked Yes/Checked",
     "value": "1 AOF, 2 signature card, 3 certificate of registration, 4 MEMART, 5 CO7, 6 CO2, 7 passport photos, 8 introduction letter, 11a evidence of ID, 13 proof of address, 14 board resolution"
    },
    {
     "name": "Document checked by (HNFT)",
     "value": "Amarachi (surname partly illegible), staff TN032817, 08/08/2026"
    },
    {
     "name": "Account opening authorised by (HBS)",
     "value": "Ifeoluwa Oso, staff SN034189, 08/08/2026"
    },
    {
     "name": "Deferrals",
     "value": "None"
    },
    {
     "name": "MIS Freecode 9 / 10",
     "value": "23052 / 30123"
    }
   ]
  },
  "3dba8721ddeb489adfddba39ba85e071a430a2bff441ef81a9c035ce316fe8cc": {
   "package": "package2",
   "type": "avr",
   "summary": "Two address verification reports dated 07/08/2026: the business at Jokit Plaza, Isheri, Berger and the proprietor at 9 Olatude Sule Street, Olowora, Berger; both confirmed.",
   "fields": [
    {
     "name": "Business applicant",
     "value": "ACO SWIFT LOGISTICS"
    },
    {
     "name": "Business address",
     "value": "JOKIT PLAZA, 8, OLD OLOWO IRA ROAD, ISHERI; Town BERGER; State LAGOS"
    },
    {
     "name": "Business verification date",
     "value": "07/08/2026"
    },
    {
     "name": "Business residing at stated address",
     "value": "Yes (identifier confirmed: Yes)"
    },
    {
     "name": "Business landmark",
     "value": "Close to Sweet Sensation & Isheri Police Station"
    },
    {
     "name": "Business premises",
     "value": "A two storey building with glass and a see through gate, painted black"
    },
    {
     "name": "Proprietor applicant",
     "value": "AFOLAYAN OLAJIDE OLUWADARE"
    },
    {
     "name": "Proprietor address",
     "value": "9, OLATUDE SULE STREET, OLOWORA; Town BERGER; State LAGOS"
    },
    {
     "name": "Proprietor verification date",
     "value": "07/08/2026"
    },
    {
     "name": "Proprietor residing at stated address",
     "value": "Yes (identifier confirmed: Yes)"
    },
    {
     "name": "Proprietor landmark",
     "value": "Adjacent Fermina Estate & opposite a transformer"
    },
    {
     "name": "Proprietor house",
     "value": "A storey building painted grey with a black gate"
    },
    {
     "name": "RM",
     "value": "Subair Ayorinde, SN030074"
    }
   ]
  },
  "bf41c5b370d352d117286efd0d04a20787470e78fedc083413d54a0cc4819c18": {
   "package": "package2",
   "type": "board-resolution",
   "summary": "Letterhead resolution dated 05-08-2026 to open an account with FirstBank Marina; sole signatory Afolayan Olajide Oluwadare; marked 'Confirmed Authentic' by RM Subair Ayorinde.",
   "fields": [
    {
     "name": "Letterhead",
     "value": "ACO SWIFT LOGISTICS, JOKIT PLAZA, 8 OLD OLOWO IRA ROAD, ISHERI, BERGER, LAGOS; Phone +234(807)1343948; Email demo.acoswift@gmail.com"
    },
    {
     "name": "Addressed to",
     "value": "The Manager, First Bank Nigeria Limited, Marina Branch, Lagos"
    },
    {
     "name": "Date",
     "value": "05-08-2026"
    },
    {
     "name": "Meeting",
     "value": "Held at JOKIT PLAZA, 8 OLD OLOWO IRA ROAD, ISHERI, BERGER, LAGOS on 05-08-2026"
    },
    {
     "name": "Resolution",
     "value": "Open a corporate account with First Bank Nigeria Limited"
    },
    {
     "name": "Signatory",
     "value": "AFOLAYAN OLAJIDE OLUWADARE"
    },
    {
     "name": "Mandate rule",
     "value": "Sole Signatory"
    },
    {
     "name": "Signed by",
     "value": "AFOLAYAN OLAJIDE OLUWADARE, DIRECTOR"
    },
    {
     "name": "Annotation",
     "value": "Confirmed Authentic, Subair Ayorinde SH030074"
    }
   ]
  },
  "80a1de612b5d405f711c27cf204973b67ecb61f72840f992c2511403a254ee50": {
   "package": "package2",
   "type": "bvn-portal",
   "summary": "Scanned BVN Validation Portal result for Olajide Oluwadare Afolayan, searched 06-08-2026, stamped Head Non-Financial Transaction.",
   "fields": [
    {
     "name": "BVN",
     "value": "22196593360"
    },
    {
     "name": "Registration Date",
     "value": "13-FEB-15"
    },
    {
     "name": "First Name",
     "value": "OLAJIDE"
    },
    {
     "name": "Middle Name",
     "value": "OLUWADARE"
    },
    {
     "name": "Last Name",
     "value": "AFOLAYAN"
    },
    {
     "name": "Birth Date",
     "value": "03-May-1986"
    },
    {
     "name": "Phone",
     "value": "08082193113"
    },
    {
     "name": "NIN",
     "value": "(blank)"
    },
    {
     "name": "Enrollment Branch",
     "value": "IKOTA BRANCH"
    },
    {
     "name": "Enrollment Institution",
     "value": "ACCESS BANK"
    },
    {
     "name": "Searched",
     "value": "06-08-2026 5:11:09 PM by demo.khayriyyah@firstbanknigeria.com"
    }
   ]
  },
  "e8cc10e2623205100fe12a62a1d0098c7705008cc6e10b2302f30931cff0a67d": {
   "package": "package2",
   "type": "bvn-api",
   "summary": "BVN API printout (text layer) for Olajide Oluwadare Afolayan with photo; not watchlisted.",
   "fields": [
    {
     "name": "BVN Number",
     "value": "22196593360"
    },
    {
     "name": "First Name",
     "value": "OLAJIDE"
    },
    {
     "name": "Last Name",
     "value": "AFOLAYAN"
    },
    {
     "name": "Middle Name",
     "value": "OLUWADARE"
    },
    {
     "name": "Date of Birth",
     "value": "03-May-1986"
    },
    {
     "name": "Mobile",
     "value": "08082193113"
    },
    {
     "name": "Gender",
     "value": "Male"
    },
    {
     "name": "Marital Status",
     "value": "Single"
    },
    {
     "name": "BVN Watchlisted",
     "value": "NO"
    }
   ]
  },
  "84fcb853e82bbdf36e439f16fdb8e4b5184e746bd160a53c0eab12abacb30452": {
   "package": "package2",
   "type": "cac-certificate",
   "summary": "CAC Certificate of Registration of Business Name for ACO SWIFT LOGISTICS (6 August 2020) plus the registration application naming Afolayan Olajide Oluwadare as proprietor; marked 'Confirmed Authentic'.",
   "fields": [
    {
     "name": "BN Number",
     "value": "BN 3157805"
    },
    {
     "name": "Business Name",
     "value": "ACO SWIFT LOGISTICS"
    },
    {
     "name": "General Nature of Business",
     "value": "GENERAL COMMERCE AND LOGISTICS"
    },
    {
     "name": "Principal Place of Business",
     "value": "JOKIT PLAZA, 8 OLD OLOWO IRA ROAD, ISHERI, BERGER, LAGOS"
    },
    {
     "name": "Registration Date",
     "value": "6th day of August, 2020"
    },
    {
     "name": "CRBN",
     "value": "1225690"
    },
    {
     "name": "Registrar",
     "value": "A. G. Abubakar, Registrar of Business Names"
    },
    {
     "name": "Proprietor",
     "value": "AFOLAYAN OLAJIDE OLUWADARE, 12 Olatunde Sule Street, Off Adetubero Street, Olowo Ira, Berger, Lagos"
    },
    {
     "name": "Proprietor phone / email",
     "value": "08082193113 / demo.acoswift@gmail.com"
    },
    {
     "name": "Application signed",
     "value": "31/07/2020"
    },
    {
     "name": "Date of commencement",
     "value": "Aug 1, 2020"
    },
    {
     "name": "Certified true copy",
     "value": "10 AUG 2020"
    },
    {
     "name": "Presented for filing by",
     "value": "Nwaji Chimaroke, ICAN/FM/1105, 1 Ebun-Olu Close, Ikosi, Lagos, 08056859843, demo.chimaroke@gmail.com"
    },
    {
     "name": "Annotation",
     "value": "Confirmed Authentic, Subair Ayorinde SH030074"
    }
   ]
  },
  "900f18cffadd1300f9b9ec1e95a0acca68998a3f702a6a11c7df3b91696740bf": {
   "package": "package2",
   "type": "consent",
   "summary": "FirstBank personal data processing consent form signed for ACO SWIFT LOGISTICS on 07-08-2026.",
   "fields": [
    {
     "name": "Name",
     "value": "ACO SWIFT LOGISTICS"
    },
    {
     "name": "Header annotation",
     "value": "AFOLAYAN OLAJIDE OLUWADARE"
    },
    {
     "name": "Signed",
     "value": "Yes"
    },
    {
     "name": "Date",
     "value": "07-08-2026"
    }
   ]
  },
  "0c2a9e2577d1b74ac390fdfb1e8a7ab8822b5b5e525e14b294b6d0a8c073d9e9": {
   "package": "package2",
   "type": "cdd",
   "summary": "KYC Customer Due Diligence review (corporate) for ACO SWIFT LOGISTICS: single 100% UBO, not a PEP, prepared by RM Subair Ayorinde on 07-08-2026.",
   "fields": [
    {
     "name": "Full customer's name",
     "value": "ACO SWIFT LOGISTICS"
    },
    {
     "name": "Sol ID",
     "value": "230"
    },
    {
     "name": "Nature of business",
     "value": "LOGISTICS"
    },
    {
     "name": "Business address",
     "value": "JOKIT PLAZA, 8, OLD OLOWO IRA ROAD, ISHERI, BERGER, LAGOS"
    },
    {
     "name": "Jurisdiction",
     "value": "NIGERIA"
    },
    {
     "name": "Purpose of account",
     "value": "TO RECIEVE BUSINESS PROCEEDS"
    },
    {
     "name": "Estimated annual turnover",
     "value": "BELOW 50 MILLION"
    },
    {
     "name": "Source of funds",
     "value": "BUSINESS / PERSONAL SAVINGS"
    },
    {
     "name": "UBO name",
     "value": "AFOLAYAN OLAJIDE OLUWADARE"
    },
    {
     "name": "UBO address",
     "value": "9, OLATUDE SULE STREET, OLOWORA, LAGOS"
    },
    {
     "name": "UBO nationality",
     "value": "NIGERIAN"
    },
    {
     "name": "UBO BVN",
     "value": "22196593360"
    },
    {
     "name": "UBO ID",
     "value": "NIN 49269893980"
    },
    {
     "name": "UBO shareholding",
     "value": "100%"
    },
    {
     "name": "UBO occupation",
     "value": "LOGISTICS"
    },
    {
     "name": "UBO PEP status",
     "value": "NO"
    },
    {
     "name": "Adverse news",
     "value": "N/A"
    },
    {
     "name": "Primary products/services",
     "value": "DELIVERY OF CLOTHES, SHOES AND HOUSEHOLD ITEMS"
    },
    {
     "name": "Client base",
     "value": "INDIVIDUALS AND BUSINESSES"
    },
    {
     "name": "Relationship Manager",
     "value": "SUBAIR AYORINDE, Staff No SN030074, Branch MARINA, 07-08-2026"
    }
   ]
  },
  "11ccc2fe2db6ccdd8ee9c4d2a830d73f40a10535b9fa9d9b3c26b6137d3a06f0": {
   "package": "package2",
   "type": "nin-lookup",
   "summary": "Verify Customer NIN screen for Olajide Oluwadare Afolayan, checked 07 Aug 2026, stamped Head Non-Financial Transaction.",
   "fields": [
    {
     "name": "NIN",
     "value": "49269893980"
    },
    {
     "name": "First Name",
     "value": "OLAJIDE"
    },
    {
     "name": "Last Name",
     "value": "AFOLAYAN"
    },
    {
     "name": "Middle Name",
     "value": "OLUWADARE"
    },
    {
     "name": "Phone Number",
     "value": "08082193113"
    },
    {
     "name": "Address",
     "value": "12 OLATUNDE SULE STREET"
    },
    {
     "name": "Checked By",
     "value": "TN032817"
    },
    {
     "name": "Date Checked",
     "value": "Fri Aug 07 2026 11:58:15 GMT+0100 (West Africa Time)"
    },
    {
     "name": "Gender",
     "value": "m"
    },
    {
     "name": "Date of Birth",
     "value": "03-05-1986"
    },
    {
     "name": "Email",
     "value": "(blank)"
    }
   ]
  },
  "c97ed3a162d532c2907095e8e2dae145049c018d9f78f121964b6249d60cd76c": {
   "package": "package2",
   "type": "mandate",
   "summary": "3-page entity account mandate (SME Classic): sole proprietorship, sole signatory Afolayan Olajide Oluwadare (Class A) with photo, plus an email-instruction indemnity dated 7th August 2026.",
   "fields": [
    {
     "name": "Account Type",
     "value": "Sole Proprietorship"
    },
    {
     "name": "Account Name",
     "value": "ACO SWIFT LOGISTICS"
    },
    {
     "name": "Mandate rule",
     "value": "Sole Signatory"
    },
    {
     "name": "Signatory",
     "value": "AFOLAYAN OLAJIDE OLUWADARE"
    },
    {
     "name": "ID type",
     "value": "National ID"
    },
    {
     "name": "ID number",
     "value": "49269893980"
    },
    {
     "name": "Signature class",
     "value": "A"
    },
    {
     "name": "Date",
     "value": "07/08/2026"
    },
    {
     "name": "Additional signatory",
     "value": "None"
    },
    {
     "name": "Authorised officer",
     "value": "Ifeoluwa Oso, SN034189"
    },
    {
     "name": "Email indemnity",
     "value": "ACO SWIFT LOGISTICS, JOKIT PLAZA, 8, OLD OLOWO IRA ROAD, ISHERI, BERGER, LAGOS; primary e-mail demo.olajide@gmail.com; dated 7th August 2026; signed Director"
    }
   ]
  },
  "c46d4d28802c7bec829365682364405309b1e26ed85f354b8e9a2ef5dcf7a545": {
   "package": "package2",
   "type": "others-printout",
   "summary": "Alert-profiler 'View Customer Accounts by Mobile Number' screen (8/12/26) showing the new ACO SWIFT LOGISTICS current account tied to the proprietor's mobile; annotated 'Same customer'.",
   "fields": [
    {
     "name": "Mobile Number searched",
     "value": "08071343948 (+234 - Nigeria)"
    },
    {
     "name": "Account Number",
     "value": "2046067974"
    },
    {
     "name": "Account Name",
     "value": "ACO SWIFT LOGISTICS"
    },
    {
     "name": "Customer ID",
     "value": "230804956"
    },
    {
     "name": "Account Scheme / Type",
     "value": "CA304 / CURRENT"
    },
    {
     "name": "Alert Status",
     "value": "Active"
    },
    {
     "name": "Annotation",
     "value": "Same customer; stamped Head Non-Financial Transaction, Marina Branch; Ifeoluwa Oso SN034189"
    }
   ]
  },
  "e2aa6b29da0604c04407db00cb4e122897c384b52164135547211902c26dc800": {
   "package": "package2",
   "type": "references",
   "summary": "Two FirstBank reference forms dated 06/08/2026 for applicant ACO SWIFT LOGISTICS (Marina branch), from Dailey's Glam Enterprise and Gabkon Integrated Nigeria Ltd.",
   "fields": [
    {
     "name": "Applicant account no.",
     "value": "2046067974"
    },
    {
     "name": "Referee 1",
     "value": "DAILEY'S GLAM ENTERPRISE, 8, DAILEY STREET, SHOMOLU, LAGOS"
    },
    {
     "name": "Referee 1 bank / branch",
     "value": "FIRST BANK / KEFFI"
    },
    {
     "name": "Referee 1 account",
     "value": "2040520956 (DAILEY'S GLAM ENTERPRISE)"
    },
    {
     "name": "Referee 2",
     "value": "GABKON INTEGRATED NIGERIA LTD, 4, PALACE WAY, AREPO OFF LAGOS IBADAN EXPRESSWAY, OGUN"
    },
    {
     "name": "Referee 2 bank / branch",
     "value": "FIRST BANK / ILUPEJU"
    },
    {
     "name": "Referee 2 account",
     "value": "2045912527 (GABKON INTEGRATED NIGERIA LTD)"
    },
    {
     "name": "Branch addressed",
     "value": "MARINA"
    },
    {
     "name": "Date",
     "value": "06/08/2026 (both)"
    }
   ]
  },
  "0d2560225efbba9fad8d2b4fe8d0cda92fefc52f4c90353789f154bf83d44c0b": {
   "package": "package2",
   "type": "tin-printout",
   "summary": "Tax ID retrieval screen (JRB/NRS) confirming the RC number matches a Tax ID for ACO SWIFT LOGISTICS; stamped and initialled by Ifeoluwa Oso.",
   "fields": [
    {
     "name": "Search",
     "value": "Corporate; organization name or RC number 3157805"
    },
    {
     "name": "Name",
     "value": "ACO SWIFT LOGISTICS"
    },
    {
     "name": "Tax ID",
     "value": "2627186376208"
    },
    {
     "name": "Result",
     "value": "RC Number successfully verified and matches a Tax-ID"
    },
    {
     "name": "Annotation",
     "value": "Head Non-Financial Transaction stamp; SN034189 Ifeoluwa Oso"
    }
   ]
  },
  "9df6553a544df0283bee5cdc1992993266898145a00fd0f4b4d9edab2240f53c": {
   "package": "stanbic-entity",
   "type": "aof",
   "summary": "12-page Stanbic IBTC entity account opening form for GEORGE EMORE TECHNICAL ENTERPRISES LTD (limited liability company), Alausa branch: company details, two director/signatories, references, online-banking users, account setup, indemnity, signed 19/06/2026.",
   "fields": [
    {
     "name": "Form",
     "value": "Stanbic IBTC Account Opening Form — Entities (Incorporated and Non-Incorporated)"
    },
    {
     "name": "Branch",
     "value": "ALAUSA"
    },
    {
     "name": "Account type",
     "value": "Current account · Corporate account"
    },
    {
     "name": "Business name",
     "value": "GEORGE EMORE TECHNICAL ENTERPRISES LTD"
    },
    {
     "name": "Registration number",
     "value": "961904"
    },
    {
     "name": "Date of incorporation",
     "value": "17/06/2026"
    },
    {
     "name": "Nature of business",
     "value": "CONSULTANCY IN INFOTECH"
    },
    {
     "name": "Sector",
     "value": "INFORMATION TECHNOLOGY"
    },
    {
     "name": "Operating address",
     "value": "45, AJOSE STREET, MENDE, MARYLAND, LAGOS"
    },
    {
     "name": "Registered office",
     "value": "Same as above"
    },
    {
     "name": "Email",
     "value": "demo.efe@gmail.com"
    },
    {
     "name": "Phone",
     "value": "08072402996"
    },
    {
     "name": "TIN",
     "value": "26271929944026"
    },
    {
     "name": "Annual turnover",
     "value": "Less than N400m"
    },
    {
     "name": "Quoted on an exchange",
     "value": "No"
    },
    {
     "name": "Services",
     "value": "SME Online · SMS alerts"
    },
    {
     "name": "Signatory 1",
     "value": "EMORE EFE GEORGE — CEO, Class A, Director"
    },
    {
     "name": "Signatory 1 DOB",
     "value": "14/02/1967"
    },
    {
     "name": "Signatory 1 ID",
     "value": "International Passport B03166085 · expires 13/03/2029"
    },
    {
     "name": "Signatory 2",
     "value": "AKERELE KEHINDE OMOTAYO — HR Manager, Class A, Director"
    },
    {
     "name": "Signatory 2 DOB",
     "value": "04/12/1977"
    },
    {
     "name": "Signatory 2 ID",
     "value": "International Passport B00562479 · expires 12/11/2026"
    },
    {
     "name": "Mandate",
     "value": "Both signatories Class A; online banking Initiator / Approver each"
    },
    {
     "name": "Daily transaction limit",
     "value": "N50,000,000"
    },
    {
     "name": "Referee 1",
     "value": "Microconcept Techniques & Associates Ltd — Stanbic IBTC, known over 10 years"
    },
    {
     "name": "Referee 2",
     "value": "Equipment Leasing Association of Nigeria — Sterling Bank, known 25 years"
    },
    {
     "name": "Company seal",
     "value": "GEORGE EMORE TECHNICAL ENTERPRISES LTD"
    },
    {
     "name": "Signed",
     "value": "19/06/2026 by both directors; T&Cs signed 13/07/2026"
    }
   ]
  },
  "50c09edbaa5b00e1f339c17b4dd08db7603d1fb40affd05f9029de3b1b5dee88": {
   "package": "firstbank-corporate",
   "type": "aof",
   "summary": "FirstBank Corporate / SME account opening form for ABA INTEGRATED SOLUTIONS LIMITED (limited liability company, Abuja Main branch): entity details, turnover, services, UBO, one authorised officer (director, signatory, UBO), consent, signed and witnessed, bank checklist \"NOT PEP\". 13 of 16 printed pages; pages 9, 10 and 12 are not in the scan.",
   "fields": [
    {
     "name": "Form",
     "value": "FirstBank Corporate / SME Account Opening Form (CORP) — 13 of 16 printed pages; pages 9, 10 and 12 not in the scan"
    },
    {
     "name": "Account type",
     "value": "Corporate Current"
    },
    {
     "name": "Branch",
     "value": "ABUJA MAIN"
    },
    {
     "name": "Account number (official use)",
     "value": "2046064997 — needs manual review"
    },
    {
     "name": "BVN",
     "value": "22476998209"
    },
    {
     "name": "NIN",
     "value": "82041948706"
    },
    {
     "name": "Business category",
     "value": "Limited Liability Company"
    },
    {
     "name": "Business name",
     "value": "ABA INTEGRATED SOLUTIONS LIMITED"
    },
    {
     "name": "Registration number",
     "value": "9740483"
    },
    {
     "name": "Date of registration",
     "value": "04/08/2026 — needs manual review"
    },
    {
     "name": "Jurisdiction",
     "value": "ABUJA"
    },
    {
     "name": "Nature of business / sector",
     "value": "INFORMATION TECHNOLOGY"
    },
    {
     "name": "Operating address",
     "value": "18 OBAFEMI AWOLOWO STREET, LUGBE, ABUJA - FCT"
    },
    {
     "name": "Email",
     "value": "demo.babajide@gmail.com"
    },
    {
     "name": "Phone 1",
     "value": "07006744899 — needs manual review"
    },
    {
     "name": "TIN",
     "value": "26242217379523 — low confidence, needs manual review"
    },
    {
     "name": "Annual turnover",
     "value": "Below 50 Million · not quoted on an exchange"
    },
    {
     "name": "Services",
     "value": "Email + SMS alerts (both) · FirstOnline internet banking · monthly statements"
    },
    {
     "name": "Cheque threshold",
     "value": "Standard ₦1,000,000"
    },
    {
     "name": "UBO declared",
     "value": "ADELAJA BABAJIDE ADETAYO"
    },
    {
     "name": "Search-report debit",
     "value": "₦9,900 — CAC search, signed"
    },
    {
     "name": "Email indemnity & data consent",
     "value": "Signed by ADELAJA BABAJIDE ADETAYO for the company, 11/08/2026"
    },
    {
     "name": "Authorised officer",
     "value": "MR ADELAJA BABAJIDE ADETAYO — Signatory, UBO, Director; Accountant; DOB 06/10/1984; M; born Abuja"
    },
    {
     "name": "Officer's mother's maiden name",
     "value": "ANGELA — needs manual review"
    },
    {
     "name": "Officer's ID",
     "value": "National ID card 82041948706"
    },
    {
     "name": "Officer's address",
     "value": "18 OBAFEMI AWOLOWO STREET, LUGBE, ABUJA · LGA AMAC"
    },
    {
     "name": "Officer's signature",
     "value": "Signed 10/08/2026"
    },
    {
     "name": "Signed, sealed & delivered",
     "value": "ADELAJA BABAJIDE ADETAYO, CEO, 11/08/2026 · company seal not present"
    },
    {
     "name": "Witness",
     "value": "OBU JOHN, Doctor, 32 WARRI, DELTA — low confidence"
    },
    {
     "name": "PEP",
     "value": "NOT PEP (handwritten)"
    },
    {
     "name": "Document checked by",
     "value": "UMORU EDWINA ENE · TN085308 · 12/08/2026"
    },
    {
     "name": "Account opening authorised by",
     "value": "ADESEMI EZEUH · SN031022 · 12/08/2026 — low confidence"
    },
    {
     "name": "Finacle MIS codes",
     "value": "6 · 601 · 60101 · 40675 · 28184"
    },
    {
     "name": "Corporate online banking",
     "value": "IDs ABAA / ABAAA / ABABA · administrator with transaction right · user ABAA"
    },
    {
     "name": "Account holder signature",
     "value": "Signed 11/08/2026 · FIRS ₦50 stamp affixed"
    }
   ]
  },
  "60dde2270e39018df87f00cc7263ba980b71c06ef6a8f972abd4f542be9e78f1": {
   "package": "firstbank-individual",
   "type": "aof",
   "summary": "FirstBank individual account opening form (AOF/ADT/0825) for MR DADA OLUMUYIWA OLUWAFEMI, Alapere branch: personal and contact details, services, national ID, employment (Lagos State Government), next of kin, declaration, bank checklist (not PEP) and FATCA/CRS supplement. 10 pages.",
   "fields": [
    {
     "name": "Form",
     "value": "FirstBank Application to Open an Individual Account (AOF/ADT/0825) + FATCA/CRS supplement — 10 pages"
    },
    {
     "name": "Handwritten note",
     "value": "\"Existing account\" with two account numbers — low confidence, needs manual review"
    },
    {
     "name": "Branch",
     "value": "ALAPERE"
    },
    {
     "name": "Account category",
     "value": "Current · Domiciliary (USD, GBP) — conflicts with purpose \"SAVINGS\""
    },
    {
     "name": "BVN",
     "value": "22303594107 — needs manual review"
    },
    {
     "name": "NIN",
     "value": "57076619354 — needs manual review"
    },
    {
     "name": "Applicant",
     "value": "MR DADA OLUMUYIWA OLUWAFEMI · M · Single · born 02/12/1992, IKEJA"
    },
    {
     "name": "Mother's maiden name",
     "value": "BAKRE — needs manual review"
    },
    {
     "name": "Origin",
     "value": "LAGOS · LGA ALIMOSHO · Nigerian, no dual citizenship"
    },
    {
     "name": "Address",
     "value": "4 TINUBU STREET, ALAPERE, KETU, LAGOS · LGA KOSOFE"
    },
    {
     "name": "Phone",
     "value": "08126040258"
    },
    {
     "name": "Email",
     "value": "demo.olumuyiwa@gmail.com — needs manual review"
    },
    {
     "name": "Services",
     "value": "Mobile + Internet banking · SMS + Email alerts · Naira debit card · no cheque book"
    },
    {
     "name": "ID",
     "value": "National ID card 57076619354 · issued 23/??/2024 (month illegible) · no expiry"
    },
    {
     "name": "Employment",
     "value": "Employed since 19/11/2018 · Lagos State Government, Alausa Secretariat · Civil servant / Information officer · N51,000–N250,000"
    },
    {
     "name": "Next of kin",
     "value": "DADA OLUWAKEMI · Sister · F · born 31/05/1977 · 4B TINUBU STREET, ALAPERE, KETU"
    },
    {
     "name": "Declaration",
     "value": "Signed 15/06/2026 · FIRS ₦50 stamp affixed"
    },
    {
     "name": "FATCA / CRS",
     "value": "Resident and born in Nigeria · No to all five questions · signed 06/07/2026"
    },
    {
     "name": "Checklist",
     "value": "Photo, ID, consent, BVN+NIN and references marked Yes/Checked · proof of address not marked"
    },
    {
     "name": "PEP",
     "value": "No"
    },
    {
     "name": "Document checked by",
     "value": "AYOADE DAVID · TN051226 · 07/07/2026"
    },
    {
     "name": "Account opening authorised by",
     "value": "ESSIEN ENO · SN030418 · 07/07/2026 — needs manual review"
    },
    {
     "name": "Finacle MIS codes",
     "value": "5 · 530 · 53020 · 44274 · RM442"
    },
    {
     "name": "Points to review",
     "value": "Product conflict (Current/Domiciliary vs SAVINGS) · passport photo box empty but checklist says received · proof of address missing · same phone for applicant and employer"
    }
   ]
  },
  "ad2f0bd0f398e06bee81d70d20b88b0057c321f64b3dd85a5f89a1460825201f": {
   "package": "stanbic-firscs",
   "type": "aof",
   "summary": "12-page Stanbic IBTC entity account opening form (Biz Smart, sole proprietor) for FIRSCS COLLECTION SERVICES, Gusau branch, signed 14/01/2025 by Sanusi Kaura Musa. Pages 1 and 2 are the same first page before and after the BN number and registration date were filled in; it also carries the authority to debit the CAC search fee, the email/telephone indemnity, the enterprise internet-banking form and the account set-up page (₦200,000,000 daily limit).",
   "fields": [
    {
     "name": "Business Name",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "Business Category",
     "value": "Sole Proprietor"
    },
    {
     "name": "Account Type",
     "value": "Biz Smart"
    },
    {
     "name": "Branch",
     "value": "GUSAU"
    },
    {
     "name": "BN Number",
     "value": "7993220"
    },
    {
     "name": "Date of Registration",
     "value": "09/10/2024"
    },
    {
     "name": "Nature of Business",
     "value": "SALES AND SUPPLY OF CLOTHS"
    },
    {
     "name": "Sector/Industry",
     "value": "TEXTILE MANUFACTURING, GENERAL CONTRACTS, GENERAL MERCHANDISE"
    },
    {
     "name": "Operating Business Address",
     "value": "ALH SANUSI MUSA KAURA RESIDENCE, T/WADA AREA, GUSAU"
    },
    {
     "name": "Registered Office",
     "value": "SAME AS ABOVE"
    },
    {
     "name": "Email",
     "value": "demo.sanusi@gmail.com"
    },
    {
     "name": "Phone Number 1",
     "value": "08075040901"
    },
    {
     "name": "TIN",
     "value": "1086565686"
    },
    {
     "name": "Annual Turnover",
     "value": "Less than ₦400m"
    },
    {
     "name": "Quoted on a stock exchange",
     "value": "No"
    },
    {
     "name": "Card",
     "value": "Debit (NGN)"
    },
    {
     "name": "Electronic banking",
     "value": "Internet banking"
    },
    {
     "name": "Statements",
     "value": "Email, quarterly"
    },
    {
     "name": "Daily transaction limit",
     "value": "₦200,000,000"
    },
    {
     "name": "Internet banking user",
     "value": "SANUSI KAURA MUSA — Initiator & final approver"
    },
    {
     "name": "Signed by",
     "value": "SANUSI KAURA MUSA, Managing Director"
    },
    {
     "name": "Date signed",
     "value": "14/01/2025"
    },
    {
     "name": "Signature verified by (bank)",
     "value": "RULWAN ABUBAKAR, 17/01/2025"
    }
   ]
  },
  "42ee65fe961a9b6c0789eedaac4f5aaf2421578a72628eb66bf17fb350b4e554": {
   "package": "stanbic-firscs",
   "type": "aof-signatory",
   "summary": "Signatory / director’s details page with passport photograph: Mr Sanusi Kaura Musa, Managing Director and sole signatory; stamped “original sighted” at the Gusau branch.",
   "fields": [
    {
     "name": "Surname",
     "value": "MUSA"
    },
    {
     "name": "First Name",
     "value": "SANUSI"
    },
    {
     "name": "Other Name",
     "value": "KAURA"
    },
    {
     "name": "Title",
     "value": "MR"
    },
    {
     "name": "Date of Birth",
     "value": "06/02/1980"
    },
    {
     "name": "Place of Birth",
     "value": "GUSAU"
    },
    {
     "name": "State of Origin",
     "value": "GUSAU"
    },
    {
     "name": "Gender",
     "value": "Male"
    },
    {
     "name": "Marital Status",
     "value": "Married"
    },
    {
     "name": "Means of Identification",
     "value": "National ID Card"
    },
    {
     "name": "ID Number",
     "value": "60330692712"
    },
    {
     "name": "BVN",
     "value": "22238737600"
    },
    {
     "name": "Occupation",
     "value": "BUSINESS"
    },
    {
     "name": "Position",
     "value": "MANAGING DIRECTOR"
    },
    {
     "name": "Street",
     "value": "ALH SANUSI MUSA KAURA RESIDENCE"
    },
    {
     "name": "Landmark",
     "value": "T/WADA AREA, GUSAU"
    },
    {
     "name": "City / LGA",
     "value": "GUSAU"
    },
    {
     "name": "State",
     "value": "ZAMFARA STATE"
    },
    {
     "name": "Phone",
     "value": "08075040901"
    },
    {
     "name": "Email",
     "value": "demo.sanusi@gmail.com"
    },
    {
     "name": "Director",
     "value": "Yes"
    },
    {
     "name": "Date signed",
     "value": "14/01/2025"
    }
   ]
  },
  "8740e53b437545dead6f0d385fd1a40206c6d666ecb0bbd273f64d293a4fdf3f": {
   "package": "stanbic-firscs",
   "type": "cac-certificate",
   "summary": "CAC Certificate of Registration of Business Name for FIRSCS COLLECTION SERVICES under CAMA 2020, 9 October 2024. The principal place of business (Maigemu Street, Tudun Wada) is not the operating address written on the form, and the TIN printed on the certificate differs from the JTB TIN on the form.",
   "fields": [
    {
     "name": "Business Name",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "Registration Number",
     "value": "7993220"
    },
    {
     "name": "Registered under",
     "value": "Companies and Allied Matters Act 2020"
    },
    {
     "name": "Nature of Business",
     "value": "TEXTILE MANUFACTURING AND SUPPLY, GENERAL CONTRACTS, GENERAL MERCHANDISE/TRADING"
    },
    {
     "name": "Principal Place of Business",
     "value": "NO 10 MAIGEMU STREET, TUDUN WADA, OPP. FMC HOSPITAL, GUSAU, ZAMFARA STATE"
    },
    {
     "name": "Date of Registration",
     "value": "09/10/2024"
    },
    {
     "name": "TIN (on certificate)",
     "value": "32221879-1231"
    },
    {
     "name": "Registrar-General",
     "value": "Hussaini Ishaq Magaji SAN"
    }
   ]
  },
  "1a5a492b045c5fc2ac2c7237930ca483d360e4d4b12e1ed4c1ffce59bf3dd537": {
   "package": "stanbic-firscs",
   "type": "cac-status",
   "summary": "CAC status report (certified extract) for FIRSCS COLLECTION SERVICES, generated 9 October 2024: active sole proprietorship, one proprietor. The proprietor’s date of birth reads June 1980, where the form and NIN slip say 6 February 1980.",
   "fields": [
    {
     "name": "Business Name",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "BN Number",
     "value": "7993220"
    },
    {
     "name": "Date of Registration",
     "value": "09/10/2024"
    },
    {
     "name": "Business Type",
     "value": "SOLE PROPRIETOR"
    },
    {
     "name": "Principal Place of Business",
     "value": "NO 10 MAIGEMU STREET, TUDUN WADA, OPP. FMC HOSPITAL, GUSAU, ZAMFARA STATE"
    },
    {
     "name": "Email",
     "value": "demo.sanusi@gmail.com"
    },
    {
     "name": "Status",
     "value": "ACTIVE"
    },
    {
     "name": "Due Date of Accounts",
     "value": "09/10/2025"
    },
    {
     "name": "Proprietor",
     "value": "MUSA SANUSI KAURA"
    },
    {
     "name": "Proprietor Date of Birth",
     "value": "June 1980"
    },
    {
     "name": "Proprietor Gender",
     "value": "Male"
    },
    {
     "name": "Proprietor Nationality",
     "value": "Nigeria"
    },
    {
     "name": "Proprietor Phone",
     "value": "08075040901"
    },
    {
     "name": "Date of Appointment",
     "value": "09/10/2024"
    }
   ]
  },
  "e6611747053b214efea664c8c39c388344211801fefcbe30e2bb66f2c590f4ca": {
   "package": "stanbic-firscs",
   "type": "tin-certificate",
   "summary": "Joint Tax Board certificate of taxpayer identification number for FIRSCS COLLECTION SERVICES, issued 24 October 2024 by the Zamfara State Board of Internal Revenue.",
   "fields": [
    {
     "name": "Taxpayer Name",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "TIN",
     "value": "1086565686"
    },
    {
     "name": "Date of Issue",
     "value": "24/10/2024"
    },
    {
     "name": "Tax Authority",
     "value": "ZAMFARA STATE BOARD OF INTERNAL REVENUE"
    },
    {
     "name": "Address",
     "value": "NO 10 MAIGEMU STREET, TUDUN WADA, OPP. FMC HOSPITAL, GUSAU, ZAMFARA STATE"
    }
   ]
  },
  "ff000813768d49122dbd22fac10b9dd51a30afa5617b8b8d6a5859ca44efcdad": {
   "package": "stanbic-firscs",
   "type": "id-document",
   "summary": "NIN slip (front and disclaimer) for Musa Sanusi Kaura, with photograph; stamped “original sighted”.",
   "fields": [
    {
     "name": "Document",
     "value": "NIN slip"
    },
    {
     "name": "Surname",
     "value": "MUSA"
    },
    {
     "name": "Given Names",
     "value": "SANUSI, KAURA"
    },
    {
     "name": "Date of Birth",
     "value": "06/02/1980"
    },
    {
     "name": "NIN",
     "value": "60330692712"
    }
   ]
  },
  "a1e60932c565c178ee181508b5e4d9fc478faffb6ab6472887e469a62f8f6990": {
   "package": "stanbic-firscs",
   "type": "utility-bill",
   "summary": "Kaduna Electric bill for December 2024 (created 2 January 2025) in the name of Alh Sanusi Musa Kaura at T/Wada Area, Gusau — the operating address on the form; account active, ₦363,748.62 due.",
   "fields": [
    {
     "name": "Biller",
     "value": "KADUNA ELECTRIC"
    },
    {
     "name": "Account Name",
     "value": "ALH SANUSI MUSA KAURA"
    },
    {
     "name": "Address",
     "value": "T/WADA AREA, GUSAU"
    },
    {
     "name": "Customer Account",
     "value": "262243972631"
    },
    {
     "name": "Phone",
     "value": "08075040901"
    },
    {
     "name": "Bill Month",
     "value": "December 2024"
    },
    {
     "name": "Bill Date",
     "value": "02/01/2025"
    },
    {
     "name": "Total Due",
     "value": "₦363,748.62"
    },
    {
     "name": "Area Office",
     "value": "ZAMFARA NORTH AO"
    }
   ]
  },
  "52576dd1ef3e6c60ecfd072e49f296043532cbcc1694d9c757d9eb3cb78e74ff": {
   "package": "stanbic-firscs",
   "type": "references",
   "summary": "Stanbic IBTC account-opening reference form for FIRSCS COLLECTION SERVICES (Gusau), two referees banking with UBA, both signed 14/01/2025.",
   "fields": [
    {
     "name": "Referee 1",
     "value": "J.C MBAKWE AND SONS GLOBAL VENTURES LTD"
    },
    {
     "name": "Referee 1 Bank",
     "value": "UBA"
    },
    {
     "name": "Referee 1 Account",
     "value": "1028905259"
    },
    {
     "name": "Referee 1 Known For",
     "value": "10 years"
    },
    {
     "name": "Referee 2",
     "value": "EMMANUEL AKOWE COMPANY"
    },
    {
     "name": "Referee 2 Bank",
     "value": "UBA"
    },
    {
     "name": "Referee 2 Account",
     "value": "1027234516"
    },
    {
     "name": "Referee 2 Known For",
     "value": "8 years"
    },
    {
     "name": "Date",
     "value": "14/01/2025"
    }
   ]
  },
  "9ef9378a3bb8581c1454824833a881114a954c159911f16dab59d16b2496460f": {
   "package": "stanbic-firscs",
   "type": "board-resolution",
   "summary": "Handwritten resolution on FIRSCS COLLECTION SERVICES letterhead to open a Biz Smart account with Stanbic IBTC Gusau, with Sanusi Kaura Musa as sole signatory; signed 14/01/2025.",
   "fields": [
    {
     "name": "Business Name",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "BN Number",
     "value": "7993220"
    },
    {
     "name": "Addressed To",
     "value": "The Manager, Stanbic IBTC, Gusau"
    },
    {
     "name": "Account",
     "value": "Biz Smart"
    },
    {
     "name": "Sole Signatory",
     "value": "SANUSI KAURA MUSA"
    },
    {
     "name": "Date",
     "value": "14/01/2025"
    }
   ]
  },
  "5e852573433e37f5199bf7406933ddf7539b97a0b520ecba28f8dfae8fe6e2e4": {
   "package": "stanbic-firscs",
   "type": "customer-letter",
   "summary": "Request on company letterhead, dated 10/03/2025, to change the e-mail address on the account — a service request after the account was opened, not part of the opening.",
   "fields": [
    {
     "name": "Request",
     "value": "Change of e-mail address"
    },
    {
     "name": "Account Number",
     "value": "0062431378"
    },
    {
     "name": "Old E-mail",
     "value": "demo.sanusi@gmail.com"
    },
    {
     "name": "New E-mail",
     "value": "demo.firscs@gmail.com"
    },
    {
     "name": "Signed By",
     "value": "SANUSI MUSA KAURA"
    },
    {
     "name": "Date",
     "value": "10/03/2025"
    }
   ]
  },
  "78bb131d0e95b5127b84a465f1da93b3b655472b1f6537abba3a166fdacd84e2": {
   "package": "stanbic-firscs",
   "type": "customer-letter",
   "summary": "Indemnity to increase the NIBSS Instant Payment (NIP) daily limit, dated 07/03/2025 — a service request after the account was opened.",
   "fields": [
    {
     "name": "Request",
     "value": "Increase NIP daily limit"
    },
    {
     "name": "Customer",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "Account Number",
     "value": "0062431378"
    },
    {
     "name": "Address",
     "value": "TUDUN WADA, OPP. FMC HOSPITAL, GUSAU"
    },
    {
     "name": "Signed By",
     "value": "SANUSI MUSA KAURA"
    },
    {
     "name": "Date",
     "value": "07/03/2025"
    }
   ]
  },
  "e9191c98cd80e4988fdb91642c63485a2d9c50809529e145bdbb21416289c8af": {
   "package": "stanbic-firscs",
   "type": "avr",
   "summary": "Address verification report by Royusuf & Co (chartered accountants), 30/01/2025: the proprietor resides at the address — verified, positive.",
   "fields": [
    {
     "name": "Vendor",
     "value": "ROYUSUF & CO. (CHARTERED ACCOUNTANTS)"
    },
    {
     "name": "Report Date",
     "value": "30/01/2025"
    },
    {
     "name": "Customer Number (CIF)",
     "value": "200537524"
    },
    {
     "name": "Subject",
     "value": "MUSA SANUSI"
    },
    {
     "name": "Address",
     "value": "ALH SANUSI MUSA KAURA RESIDENCE, T/WADA AREA, GUSAU, ZAMFARA"
    },
    {
     "name": "Result",
     "value": "VERIFIED — Positive"
    },
    {
     "name": "Customer Resides",
     "value": "Yes"
    },
    {
     "name": "Building",
     "value": "Flat, unpainted"
    },
    {
     "name": "Relationship with Owner",
     "value": "Family house"
    },
    {
     "name": "Person Interviewed",
     "value": "Customer"
    }
   ]
  },
  "a8ef103156f623ed16ebc41685b1943b7135970fe9562ce18dd0cb715ec8bece": {
   "package": "stanbic-firscs",
   "type": "avr",
   "summary": "Address verification report for the business, 30/01/2025: FIRSCS COLLECTION SERVICES operates at the address (a shop) — verified, positive.",
   "fields": [
    {
     "name": "Vendor",
     "value": "ROYUSUF & CO. (CHARTERED ACCOUNTANTS)"
    },
    {
     "name": "Report Date",
     "value": "30/01/2025"
    },
    {
     "name": "Subject",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "Address",
     "value": "ALH SANUSI MUSA KAURA RESIDENCE, T/WADA AREA, GUSAU"
    },
    {
     "name": "Result",
     "value": "VERIFIED — Positive"
    },
    {
     "name": "Relationship with Owner",
     "value": "Shop"
    },
    {
     "name": "Person Interviewed",
     "value": "Customer (the proprietor)"
    }
   ]
  },
  "721c65addb6a2d00cc03d1b3f486eb13e2468ab7ff831bc0a3894994e0dcb646": {
   "package": "stanbic-firscs",
   "type": "adverse-media",
   "summary": "Google search for “FIRSCS COLLECTION SERVICES”, 24/01/2025: results are about the Federal Inland Revenue Service and unrelated firms; nothing adverse about the applicant.",
   "fields": [
    {
     "name": "Searched",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "Date",
     "value": "24/01/2025"
    },
    {
     "name": "Source",
     "value": "Google web search (screenshots)"
    },
    {
     "name": "Result",
     "value": "No adverse media found"
    }
   ]
  },
  "4fd4d6e000a49518d97d79cb0d14526b4a08d5e8374b47e0f810892835e4079f": {
   "package": "stanbic-firscs",
   "type": "adverse-media",
   "summary": "Google search for “Sanusi Kaura Musa”, 23/01/2025: social profiles and Zamfara State government documents; nothing adverse.",
   "fields": [
    {
     "name": "Searched",
     "value": "SANUSI KAURA MUSA"
    },
    {
     "name": "Date",
     "value": "23/01/2025"
    },
    {
     "name": "Source",
     "value": "Google web search (screenshots)"
    },
    {
     "name": "Result",
     "value": "No adverse media found"
    }
   ]
  },
  "70fd382236ab735bc329c532fb3ad3e0439c48b2d84ab1bf2acec1a7d85329ab": {
   "package": "stanbic-firscs",
   "type": "legal-search",
   "summary": "Legal search by Thames Partners at the CAC, Abuja, 12/02/2025: FIRSCS COLLECTION SERVICES is duly registered; one proprietor.",
   "fields": [
    {
     "name": "Law Firm",
     "value": "THAMES PARTNERS"
    },
    {
     "name": "Search Date",
     "value": "12/02/2025"
    },
    {
     "name": "Place of Search",
     "value": "Corporate Affairs Commission, Abuja"
    },
    {
     "name": "Business Name",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "Registration Number",
     "value": "7993220"
    },
    {
     "name": "Date of Registration",
     "value": "09/10/2024"
    },
    {
     "name": "Registered Office",
     "value": "NO 10 MAIGEMU STREET, TUDUN WADA, OPP. FMC HOSPITAL, GUSAU, ZAMFARA STATE"
    },
    {
     "name": "Object",
     "value": "TEXTILE MANUFACTURING AND SUPPLY, GENERAL CONTRACTS, GENERAL MERCHANDISE/TRADING"
    },
    {
     "name": "Proprietor",
     "value": "MUSA SANUSI KAURA"
    },
    {
     "name": "Prepared By",
     "value": "PRISCA OKONKWO BL"
    }
   ]
  },
  "261c7702c220347b37b12c0bed7ecda9b94224148e3ccb6161eda785dd770aec": {
   "package": "stanbic-firscs",
   "type": "references",
   "summary": "NIBSS e-DocumentMgr certificates, generated 11/02/2025: both referees approved on 22/01/2025. The certificates name the customer’s branch as Ilupeju, not Gusau.",
   "fields": [
    {
     "name": "Referee 1",
     "value": "J.C MBAKWE AND SONS GLOBAL"
    },
    {
     "name": "Referee 1 Account",
     "value": "1028905259"
    },
    {
     "name": "Referee 1 Reference",
     "value": "221-689-305731937341275"
    },
    {
     "name": "Referee 2",
     "value": "EMMANUEL AKOWE COMPANY"
    },
    {
     "name": "Referee 2 Account",
     "value": "1027234516"
    },
    {
     "name": "Referee 2 Reference",
     "value": "221-689-305731937345141"
    },
    {
     "name": "Referee Bank",
     "value": "UNITED BANK FOR AFRICA PLC"
    },
    {
     "name": "Customer",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "Customer Branch (on certificate)",
     "value": "Ilupeju"
    },
    {
     "name": "Date of Approval",
     "value": "22/01/2025"
    }
   ]
  },
  "8066126eeb9acecaa3f78f7e6aa550bc25abaa01b01be2d9698ad4356e480f4d": {
   "package": "stanbic-firscs",
   "type": "tin-printout",
   "summary": "JTB TIN verification portal result for FIRSCS COLLECTION SERVICES: TIN, CAC number and incorporation date match the form.",
   "fields": [
    {
     "name": "Taxpayer Name",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "TIN",
     "value": "1086565686"
    },
    {
     "name": "Tax Authority",
     "value": "Zamfara State Board of Revenue"
    },
    {
     "name": "Phone",
     "value": "08075040901"
    },
    {
     "name": "Email",
     "value": "demo.sanusi@gmail.com"
    },
    {
     "name": "Incorporation Date",
     "value": "09/10/2024"
    },
    {
     "name": "CAC Number",
     "value": "BN7993220"
    }
   ]
  },
  "32a63b800f1949bb5ffb3af6495073b5376e0a7c9c272de75d9ad00bcca3f37b": {
   "package": "stanbic-firscs",
   "type": "dud-cheque",
   "summary": "CRC credit bureau dud-cheque search for FIRSCS COLLECTION SERVICES, 24/01/2025: no dishonoured cheques on record.",
   "fields": [
    {
     "name": "Bureau",
     "value": "CRC Credit Bureau"
    },
    {
     "name": "Searched",
     "value": "FIRSCS COLLECTION SERVICES"
    },
    {
     "name": "Date",
     "value": "24/01/2025"
    },
    {
     "name": "Result",
     "value": "No match — no dishonoured cheques"
    },
    {
     "name": "Requested By",
     "value": "Head office"
    }
   ]
  },
  "d851ae9df446ff337c41f9d6e1573650292d41b90bbeb2edbefa848ba395cfca": {
   "package": "stanbic-firscs",
   "type": "sanctions",
   "summary": "EastNets SFP name checker, 23/01/2025: the business and the proprietor screened against the complete list set — no detection.",
   "fields": [
    {
     "name": "Screened",
     "value": "FIRSCS COLLECTION SERVICES; SANUSI KAURA MUSA"
    },
    {
     "name": "Date",
     "value": "23/01/2025"
    },
    {
     "name": "List Set",
     "value": "Complete"
    },
    {
     "name": "Result",
     "value": "No detection found"
    }
   ]
  },
  "c7922f3c18a294813237b43c4ffc13ade7fa323907b730bba0eba6e36a6c4785": {
   "package": "stanbic-firscs",
   "type": "watchlist",
   "summary": "Stanbic IBTC internal watchlist (Excel) searched for the proprietor’s BVN: no matching entry.",
   "fields": [
    {
     "name": "Searched",
     "value": "Proprietor’s BVN"
    },
    {
     "name": "BVN",
     "value": "22238737600"
    },
    {
     "name": "Result",
     "value": "No match"
    }
   ]
  },
  "5310408dabd56220bdb29d3198f504bfc054ddf51c6b393ad0d78a421835b8ec": {
   "package": "stanbic-firscs",
   "type": "checklist",
   "summary": "Bank-use requirements checklist: the form, specimen signature, CAC certificate, resolution, photograph, ID and address proof, references, corporate search, watchlist, TIN and BVN are ticked.",
   "fields": [
    {
     "name": "Checked",
     "value": "Account opening form; specimen signature card; CAC certificate; board resolution; passport photograph; proof of identity; proof of address; two references; corporate search; watchlist check; TIN; BVN of all signatories"
    }
   ]
  },
  "fa4d4a5ad88a65b4a4f80ba3d415eab4b7ad368af1da7894da3fa053fec6b841": {
   "package": "stanbic-firscs",
   "type": "bvn-portal",
   "summary": "NIBSS BVN validation portal result for Sanusi Kaura Musa, searched 23/01/2025: name and date of birth match the form.",
   "fields": [
    {
     "name": "BVN",
     "value": "22238737600"
    },
    {
     "name": "First Name",
     "value": "SANUSI"
    },
    {
     "name": "Middle Name",
     "value": "KAURA"
    },
    {
     "name": "Last Name",
     "value": "MUSA"
    },
    {
     "name": "Date of Birth",
     "value": "06/02/1980"
    },
    {
     "name": "Phone",
     "value": "08075040901"
    },
    {
     "name": "Registration Date",
     "value": "21/03/2015"
    },
    {
     "name": "Enrollment Branch",
     "value": "GUSAU"
    },
    {
     "name": "Enrollment Institution",
     "value": "GUARANTY TRUST BANK"
    },
    {
     "name": "Searched",
     "value": "23/01/2025"
    }
   ]
  },
  "1ce40c1a7e4a3542befbff6d73d3f9493965a7623f1045023e7e6b25f9a4d214": {
   "package": "stanbic-firscs",
   "type": "nin-lookup",
   "summary": "NIMC verification for Musa Sanusi Kaura, with photograph: name and date of birth match the NIN slip.",
   "fields": [
    {
     "name": "Surname",
     "value": "MUSA"
    },
    {
     "name": "First Name",
     "value": "SANUSI"
    },
    {
     "name": "Other Name",
     "value": "KAURA"
    },
    {
     "name": "Date of Birth",
     "value": "06/02/1980"
    },
    {
     "name": "Primary Number",
     "value": "08075040901"
    },
    {
     "name": "Gender",
     "value": "N/A"
    }
   ]
  },
  "5bdba8bf52ed0101112f4550bd12819082e25b1ab64df458cd8c02e102e21108": {
   "package": "stanbic-firscs",
   "type": "bvn-portal",
   "summary": "Two later BVN portal reprints (7 and 10 March 2025) for the same BVN, made for the post-opening service requests.",
   "fields": [
    {
     "name": "BVN",
     "value": "22238737600"
    },
    {
     "name": "Name",
     "value": "SANUSI KAURA MUSA"
    },
    {
     "name": "Date of Birth",
     "value": "06/02/1980"
    },
    {
     "name": "Searched",
     "value": "07/03/2025; 10/03/2025"
    }
   ]
  }
 }
};
