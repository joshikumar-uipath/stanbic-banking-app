// ─────────────────────────────────────────────────────────────────────────────
// Country profiles — the single source of country-specific demo content.
//
// The demo ships localised to Nigeria, but the admin can switch the whole app to
// another market (Kenya, Ghana, South Africa). One profile per country carries
// everything that reads differently by market: currency, the dialect greeting,
// phone formats, city/address pools, people-name pools, employer/company names,
// merchant names, and the two KYC identity checks (label + issuing authority).
//
// The KYC *engine* still runs on internal keys 'BVN' (primary) and 'NIN'
// (secondary) — see onboarding/types.ts — so the plumbing is untouched. Only the
// labels the user sees are swapped, per `primaryId` / `secondaryId` below.
//
// Reading the active country: modules that render country-specific data call
// getActiveCountry(), which reads branding.country off the live local config
// (falling back to Nigeria). Country only changes on an admin save + reload, so
// reading it at module-init time is fine.
// ─────────────────────────────────────────────────────────────────────────────

import { loadLocalConfig } from './loader';

export type CountryCode = 'NG' | 'KE' | 'GH' | 'ZA' | 'AE' | 'SA' | 'GB' | 'US';

export interface KycId {
  /** What the customer/agent sees, e.g. "BVN" or "National ID". */
  label: string;
  /** The issuing/verifying authority, e.g. "NIBSS" or "IPRS". */
  authority: string;
  /** Prefix used when generating fake demo ID numbers. */
  numPrefix: string;
}

export interface CountryMerchants {
  supermarket: string;
  utility: string;
  telco: string;
  cafe: string;
  water: string;
  otherBank: string;
}

export interface CountryProfile {
  code: CountryCode;
  name: string;
  flag: string;
  /** Dialect greeting word shown on Home (e.g. "Jambo", "Akwaaba"). */
  greeting: string;
  currency: { code: string; symbol: string; locale: string };
  /** International dialling code, e.g. "+234". */
  phoneCc: string;
  /** Local trunk prefix for generated mobile numbers, e.g. "0803". */
  phoneTrunk: string;
  /** Timezone abbreviation shown in "last login", e.g. "WAT". */
  timezone: string;
  cities: string[];
  /** Administrative region for the city at the same index — a seeded address can
   *  then name a state that actually contains its city. */
  states: string[];
  /** Which of `firstNames` are women's names, so seeded demo records can carry a
   *  gender and title that agree with the name. Omit for a market where the split
   *  is not known — the seed then leaves gender uncaptured rather than guess. */
  femaleNames?: string[];
  streets: string[];
  firstNames: string[];
  lastNames: string[];
  /** Employer / company names for payroll batches and salary credits. */
  companies: string[];
  merchants: CountryMerchants;
  /** Internal 'BVN' check → this country's primary identity document. */
  primaryId: KycId;
  /** Internal 'NIN' check → this country's secondary identity document. */
  secondaryId: KycId;
}

export const COUNTRIES: Record<CountryCode, CountryProfile> = {
  NG: {
    code: 'NG', name: 'Nigeria', flag: '🇳🇬', greeting: 'Hello',
    currency: { code: 'NGN', symbol: '₦', locale: 'en-NG' },
    phoneCc: '+234', phoneTrunk: '0803', timezone: 'WAT',
    cities: ['Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan', 'Enugu', 'Kaduna', 'Benin City'],
    states: ['Lagos', 'FCT', 'Rivers', 'Kano', 'Oyo', 'Enugu', 'Kaduna', 'Edo'],
    streets: ['Marina Rd', 'Ahmadu Bello Way', 'Awolowo Rd', 'Aba Rd', 'Adeola Odeku St', 'Broad St'],
    firstNames: ['Adaeze', 'Chidi', 'Ngozi', 'Emeka', 'Aisha', 'Tunde', 'Fatima', 'Blessing', 'Ibrahim', 'Amina',
      'Yakubu', 'Funke', 'Sadiq', 'Chioma', 'Obinna', 'Folake', 'Bashir', 'Segun', 'Hauwa', 'Musa'],
    lastNames: ['Okafor', 'Balogun', 'Eze', 'Nwosu', 'Yusuf', 'Adeyemi', 'Bello', 'Okoro', 'Obi', 'Umeh',
      'Chukwu', 'Nwankwo', 'Okon', 'Effiong', 'Lawal', 'Garba', 'Abubakar', 'Idris', 'Ogundipe', 'Musa'],
    femaleNames: ['Adaeze', 'Ngozi', 'Aisha', 'Fatima', 'Blessing', 'Amina', 'Funke', 'Chioma', 'Folake', 'Hauwa'],
    companies: ['NYSC', 'Delta Co-op', 'Dangote Group', 'Flour Mills', 'MTN Nigeria', 'Zenith Bank', 'Access Corp'],
    merchants: { supermarket: 'Shoprite', utility: 'IKEDC Prepaid', telco: 'MTN', cafe: 'Cafe Neo', water: 'Lagos Water', otherBank: 'GTBank' },
    primaryId: { label: 'BVN', authority: 'NIBSS', numPrefix: '2221' },
    secondaryId: { label: 'NIN', authority: 'NIMC', numPrefix: '1012' },
  },
  KE: {
    code: 'KE', name: 'Kenya', flag: '🇰🇪', greeting: 'Jambo',
    currency: { code: 'KES', symbol: 'KSh', locale: 'en-KE' },
    phoneCc: '+254', phoneTrunk: '0722', timezone: 'EAT',
    cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Nyeri', 'Machakos'],
    states: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Uasin Gishu', 'Kiambu', 'Nyeri', 'Machakos'],
    streets: ['Moi Ave', 'Kenyatta Ave', 'Ngong Rd', 'Kimathi St', 'Biashara St', 'Haile Selassie Ave'],
    firstNames: ['Wanjiru', 'Otieno', 'Kamau', 'Achieng', 'Mwangi', 'Njeri', 'Brian', 'Wafula', 'Nyokabi', 'Omondi',
      'Chebet', 'Mutua', 'Grace', 'Dennis', 'Faith', 'Kevin', 'Mercy', 'Collins', 'Cynthia', 'Victor'],
    lastNames: ['Otieno', 'Kamau', 'Wanjiku', 'Mwangi', 'Njoroge', 'Ochieng', 'Kiptoo', 'Wafula', 'Onyango', 'Cheruiyot',
      'Maina', 'Ndungu', 'Karanja', 'Kariuki', 'Omondi', 'Barasa', 'Kimani', 'Wekesa', 'Mutiso', 'Njoki'],
    companies: ['Sacco Union', 'County Payroll', 'Safaricom', 'KCB Bank', 'Kenya Airways', 'EABL', 'Bidco Africa'],
    merchants: { supermarket: 'Naivas', utility: 'KPLC Prepaid', telco: 'Safaricom', cafe: 'Java House', water: 'Nairobi Water', otherBank: 'KCB' },
    primaryId: { label: 'National ID', authority: 'IPRS', numPrefix: '3' },
    secondaryId: { label: 'KRA PIN', authority: 'KRA', numPrefix: 'A0' },
  },
  GH: {
    code: 'GH', name: 'Ghana', flag: '🇬🇭', greeting: 'Akwaaba',
    currency: { code: 'GHS', symbol: '₵', locale: 'en-GH' },
    phoneCc: '+233', phoneTrunk: '024', timezone: 'GMT',
    cities: ['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Tema', 'Sunyani', 'Koforidua'],
    states: ['Greater Accra', 'Ashanti', 'Western', 'Northern', 'Central', 'Greater Accra', 'Bono', 'Eastern'],
    streets: ['Oxford St', 'Ring Rd', 'Liberation Rd', 'Independence Ave', 'Spintex Rd', 'High St'],
    firstNames: ['Kwame', 'Ama', 'Kofi', 'Akosua', 'Yaw', 'Abena', 'Kojo', 'Adwoa', 'Kwabena', 'Efua',
      'Kwaku', 'Esi', 'Nii', 'Akua', 'Yaa', 'Kwadwo', 'Afia', 'Selorm', 'Abla', 'Kojo'],
    lastNames: ['Mensah', 'Osei', 'Boateng', 'Owusu', 'Asante', 'Agyeman', 'Adjei', 'Annan', 'Appiah', 'Danso',
      'Frimpong', 'Gyasi', 'Ofori', 'Quartey', 'Sarpong', 'Tetteh', 'Yeboah', 'Amoah', 'Nkrumah', 'Addo'],
    companies: ['Cocoa Board', 'District Payroll', 'MTN Ghana', 'GCB Bank', 'Ghana Ports', 'Fan Milk', 'Kasapreko'],
    merchants: { supermarket: 'Melcom', utility: 'ECG Prepaid', telco: 'MTN', cafe: 'Vida e Caffè', water: 'Ghana Water', otherBank: 'GCB' },
    primaryId: { label: 'Ghana Card', authority: 'NIA', numPrefix: 'GHA-' },
    secondaryId: { label: 'TIN', authority: 'GRA', numPrefix: 'P00' },
  },
  ZA: {
    code: 'ZA', name: 'South Africa', flag: '🇿🇦', greeting: 'Sawubona',
    currency: { code: 'ZAR', symbol: 'R', locale: 'en-ZA' },
    phoneCc: '+27', phoneTrunk: '082', timezone: 'SAST',
    cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Gqeberha', 'Bloemfontein', 'Soweto', 'Polokwane'],
    states: ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Gauteng', 'Eastern Cape', 'Free State', 'Gauteng', 'Limpopo'],
    streets: ['Long St', 'Commissioner St', 'West St', 'Rivonia Rd', 'Church St', 'Loop St'],
    firstNames: ['Thabo', 'Lerato', 'Sipho', 'Nomsa', 'Bongani', 'Zanele', 'Themba', 'Ayanda', 'Mandla', 'Nandi',
      'Sibusiso', 'Thandiwe', 'Kagiso', 'Palesa', 'Tebogo', 'Naledi', 'Lwazi', 'Zinhle', 'Andile', 'Nokuthula'],
    lastNames: ['Nkosi', 'Dlamini', 'Khumalo', 'Mokoena', 'Ndlovu', 'Zulu', 'Molefe', 'Sithole', 'Mahlangu', 'Ngcobo',
      'Naidoo', 'Botha', 'Radebe', 'Tshabalala', 'Mthembu', 'Baloyi', 'Pillay', 'Maluleke', 'Nene', 'Mokwena'],
    companies: ['Bargaining Council', 'Municipal Payroll', 'MTN Group', 'Standard Bank', 'Sasol', 'Vodacom', 'Shoprite Holdings'],
    merchants: { supermarket: 'Checkers', utility: 'Eskom Prepaid', telco: 'Vodacom', cafe: 'Vida e Caffè', water: 'Joburg Water', otherBank: 'FNB' },
    primaryId: { label: 'SA ID', authority: 'DHA', numPrefix: '90' },
    secondaryId: { label: 'Tax number', authority: 'SARS', numPrefix: '0' },
  },
  AE: {
    code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', greeting: 'Ahlan',
    currency: { code: 'AED', symbol: 'AED', locale: 'en-AE' },
    phoneCc: '+971', phoneTrunk: '050', timezone: 'GST',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Al Ain', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
    states: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Abu Dhabi', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
    streets: ['Sheikh Zayed Rd', 'Al Wasl Rd', 'Jumeirah Beach Rd', 'Khalifa St', 'Corniche Rd', 'Al Maktoum Rd'],
    firstNames: ['Mohammed', 'Ahmed', 'Fatima', 'Aisha', 'Omar', 'Mariam', 'Khalid', 'Noura', 'Rashid', 'Hessa',
      'Saeed', 'Latifa', 'Hamdan', 'Shamma', 'Sultan', 'Alia', 'Majid', 'Reem', 'Tariq', 'Salama'],
    lastNames: ['Al Maktoum', 'Al Nahyan', 'Al Falasi', 'Al Suwaidi', 'Al Marri', 'Al Qassimi', 'Al Mansoori', 'Al Shamsi', 'Al Blooshi', 'Al Hashimi',
      'Al Zaabi', 'Al Kaabi', 'Al Nuaimi', 'Al Ali', 'Al Ketbi', 'Al Muhairi', 'Al Rashidi', 'Al Dhaheri', 'Al Awadhi', 'Al Fahim'],
    companies: ['Emirates Group', 'Emaar', 'ADNOC', 'Etisalat', 'DP World', 'Majid Al Futtaim', 'Dubai Holding'],
    merchants: { supermarket: 'Carrefour', utility: 'DEWA', telco: 'Etisalat', cafe: 'Costa Coffee', water: 'DEWA Water', otherBank: 'Emirates NBD' },
    primaryId: { label: 'Emirates ID', authority: 'ICP', numPrefix: '784-' },
    secondaryId: { label: 'Passport', authority: 'GDRFA', numPrefix: 'A' },
  },
  SA: {
    code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', greeting: 'Marhaba',
    currency: { code: 'SAR', symbol: 'SR', locale: 'en-SA' },
    phoneCc: '+966', phoneTrunk: '050', timezone: 'AST',
    cities: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Tabuk', 'Abha'],
    states: ['Riyadh', 'Makkah', 'Makkah', 'Madinah', 'Eastern Province', 'Eastern Province', 'Tabuk', 'Asir'],
    streets: ['King Fahd Rd', 'Olaya St', 'Tahlia St', 'King Abdullah Rd', 'Prince Sultan Rd', 'Al Urubah Rd'],
    firstNames: ['Mohammed', 'Abdullah', 'Sara', 'Noura', 'Faisal', 'Reem', 'Khalid', 'Aisha', 'Fahad', 'Latifa',
      'Sultan', 'Maha', 'Turki', 'Hessa', 'Bandar', 'Amal', 'Saud', 'Lama', 'Nayef', 'Jawaher'],
    lastNames: ['Al Saud', 'Al Qahtani', 'Al Ghamdi', 'Al Otaibi', 'Al Shehri', 'Al Dossari', 'Al Harbi', 'Al Zahrani', 'Al Malki', 'Al Mutairi',
      'Al Shammari', 'Al Anazi', 'Al Subaie', 'Al Balawi', 'Al Juhani', 'Al Rashid', 'Al Amri', 'Al Faifi', 'Al Omar', 'Al Dawsari'],
    companies: ['Saudi Aramco', 'SABIC', 'STC', 'Almarai', 'Al Rajhi', 'ACWA Power', 'Ministry Payroll'],
    merchants: { supermarket: 'Panda', utility: 'SEC', telco: 'STC', cafe: "Barn's", water: 'NWC', otherBank: 'Al Rajhi Bank' },
    primaryId: { label: 'National ID', authority: 'Absher', numPrefix: '1' },
    secondaryId: { label: 'Iqama', authority: 'Jawazat', numPrefix: '2' },
  },
  GB: {
    code: 'GB', name: 'United Kingdom', flag: '🇬🇧', greeting: 'Hello',
    currency: { code: 'GBP', symbol: '£', locale: 'en-GB' },
    phoneCc: '+44', phoneTrunk: '07700', timezone: 'GMT',
    cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Bristol', 'Liverpool', 'Edinburgh'],
    states: ['Greater London', 'Greater Manchester', 'West Midlands', 'West Yorkshire', 'Scotland', 'Bristol', 'Merseyside', 'Scotland'],
    streets: ['High St', 'Baker St', 'Kings Rd', 'Victoria Rd', 'Church Ln', 'Station Rd'],
    firstNames: ['Oliver', 'Amelia', 'Harry', 'Isla', 'Jack', 'Ava', 'George', 'Mia', 'Noah', 'Emily',
      'Charlie', 'Grace', 'Thomas', 'Sophie', 'James', 'Poppy', 'Oscar', 'Freya', 'William', 'Ella'],
    lastNames: ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Patel', 'Evans',
      'Roberts', 'Walker', 'Wright', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Thomas'],
    companies: ['NHS Trust', 'Tesco PLC', 'BT Group', 'Barclays', 'Unilever', 'BP', 'Civil Service'],
    merchants: { supermarket: 'Tesco', utility: 'British Gas', telco: 'EE', cafe: 'Costa Coffee', water: 'Thames Water', otherBank: 'Barclays' },
    primaryId: { label: 'National Insurance No.', authority: 'HMRC', numPrefix: 'AB' },
    secondaryId: { label: 'Passport', authority: 'HMPO', numPrefix: '5' },
  },
  US: {
    code: 'US', name: 'United States', flag: '🇺🇸', greeting: 'Hi',
    currency: { code: 'USD', symbol: '$', locale: 'en-US' },
    phoneCc: '+1', phoneTrunk: '415', timezone: 'ET',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Seattle', 'Austin', 'Boston'],
    states: ['NY', 'CA', 'IL', 'TX', 'FL', 'WA', 'TX', 'MA'],
    streets: ['Main St', 'Broadway', 'Park Ave', 'Elm St', 'Oak Ave', 'Sunset Blvd'],
    firstNames: ['James', 'Mary', 'Michael', 'Jennifer', 'Robert', 'Linda', 'David', 'Emily', 'Daniel', 'Ashley',
      'Christopher', 'Jessica', 'Matthew', 'Amanda', 'Joshua', 'Sarah', 'Andrew', 'Nicole', 'Ryan', 'Olivia'],
    lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
      'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Nguyen', 'Walker'],
    companies: ['Acme Corp', 'TechCorp Inc', 'Global Logistics', 'Metro Health', 'Payroll Services LLC', 'Amazon', 'Delta Airlines'],
    merchants: { supermarket: 'Walmart', utility: 'ConEd', telco: 'Verizon', cafe: 'Starbucks', water: 'City Water', otherBank: 'Chase' },
    primaryId: { label: 'SSN', authority: 'SSA', numPrefix: '5' },
    secondaryId: { label: "Driver's License", authority: 'DMV', numPrefix: 'D' },
  },
};

export const DEFAULT_COUNTRY: CountryCode = 'NG';

export const COUNTRY_OPTIONS: { id: CountryCode; label: string }[] =
  (Object.keys(COUNTRIES) as CountryCode[]).map((code) => ({ id: code, label: `${COUNTRIES[code].flag}  ${COUNTRIES[code].name}` }));

/** Look up a profile by code, always returning a valid profile (defaults to NG). */
export function getCountry(code?: string | null): CountryProfile {
  return COUNTRIES[(code as CountryCode)] ?? COUNTRIES[DEFAULT_COUNTRY];
}

/** The country the app is currently configured for. Reads the live local config
 *  (admin profile / preset), falling back to Nigeria. Safe to call at module init. */
export function getActiveCountry(): CountryProfile {
  try {
    const cfg = loadLocalConfig();
    return getCountry(cfg?.branding.country);
  } catch {
    return COUNTRIES[DEFAULT_COUNTRY];
  }
}

// ── KYC identity labels ──────────────────────────────────────────────────────
// The onboarding engine runs on internal check keys 'BVN' (primary identity) and
// 'NIN' (secondary identity) — see onboarding/types.ts. These map those keys to
// the active country's document names + authorities, so every surface reads in
// local terms while the plumbing stays fixed. The other checks are universal.

export const FIXED_KYC_LABELS: Record<string, string> = {
  AML: 'AML screening', PEP: 'PEP screening', FRAUD: 'Fraud screening', LIVENESS: 'Selfie check',
};

/** Short document label for a check kind, e.g. 'BVN' → "National ID" in Kenya. */
export function kycLabel(kind: string, country = getActiveCountry()): string {
  if (kind === 'BVN') return country.primaryId.label;
  if (kind === 'NIN') return country.secondaryId.label;
  return FIXED_KYC_LABELS[kind] ?? kind;
}

/** Document label + issuing authority, e.g. "BVN · NIBSS" or "National ID · IPRS". */
export function kycLabelAuthority(kind: string, sep = ' · ', country = getActiveCountry()): string {
  if (kind === 'BVN') return `${country.primaryId.label}${sep}${country.primaryId.authority}`;
  if (kind === 'NIN') return `${country.secondaryId.label}${sep}${country.secondaryId.authority}`;
  return FIXED_KYC_LABELS[kind] ?? kind;
}

/** Format an amount with the active country's grouping, e.g. 84250.5 → "84,250.50". */
export function fmtAmount(amount: number, dp = 2, country = getActiveCountry()): string {
  return amount.toLocaleString(country.currency.locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** "₦ 84,250.50" — currency code + grouped amount for the active country. */
export function moneyOf(amount: number, dp = 2, country = getActiveCountry()): string {
  return `${country.currency.code} ${fmtAmount(amount, dp, country)}`;
}
