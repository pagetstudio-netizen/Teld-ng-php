import { fromBaseCurrency, getCurrencyCode, getCurrencySymbol, PHP_TO_NGN_RATE, toBaseCurrency } from "@shared/currency";
import { getBaseSettingForCountry } from "@shared/country-settings";
import { SEAPAY_NIGERIA_BANKS } from "@shared/seapay";

// Fallback country data (used if API not available)
export const COUNTRIES = [
  { code: "PH", name: "Philippines", flag: "PH", currency: "PHP", paymentMethods: ["PayMaya", "GCash"] },
  { code: "NG", name: "Nigeria", flag: "NG", currency: "NGN", paymentMethods: SEAPAY_NIGERIA_BANKS.map((bank) => bank.name) },
];

export const FALLBACK_COUNTRIES = [
  { code: "PH", name: "Philippines", currency: "PHP", phonePrefix: "63", operators: ["PayMaya", "GCash"] },
  { code: "NG", name: "Nigeria", currency: "NGN", phonePrefix: "234", operators: SEAPAY_NIGERIA_BANKS.map((bank) => bank.name) },
];

// Legacy compatibility - kept for places still using ELIGIBLE_COUNTRIES directly
export const ELIGIBLE_COUNTRIES = FALLBACK_COUNTRIES.map(c => ({
  code: c.code,
  name: c.name,
  flag: c.code,
  currency: c.currency,
  phonePrefix: c.phonePrefix,
  paymentMethods: c.operators,
})) as readonly { code: string; name: string; flag: string; currency: string; phonePrefix: string; paymentMethods: readonly string[] }[];

export type ApiCountry = {
  id: number;
  code: string;
  name: string;
  currency: string;
  phonePrefix: string;
  operators: string; // JSON string
  isActive: boolean;
};

export function parseOperators(operatorsJson: string): string[] {
  try {
    return JSON.parse(operatorsJson);
  } catch {
    return [];
  }
}

export function getCountryByCode(code: string, apiCountries?: ApiCountry[]) {
  if (apiCountries !== undefined) {
    // API data is loaded — only use it, never fall back to hardcoded data.
    // This ensures disabled countries and updated operators are respected,
    // including when the administrator has disabled every country.
    const c = apiCountries.find(c => c.code === code && c.isActive);
    if (!c) return undefined;
    return {
      code: c.code,
      name: c.name,
      currency: c.currency,
      phonePrefix: c.phonePrefix,
      paymentMethods: parseOperators(c.operators),
    };
  }
  // API not yet loaded — use hardcoded fallback temporarily
  const fallback = FALLBACK_COUNTRIES.find(c => c.code === code);
  if (!fallback) return undefined;
  return {
    code: fallback.code,
    name: fallback.name,
    currency: fallback.currency,
    phonePrefix: fallback.phonePrefix,
    paymentMethods: fallback.operators,
  };
}

export function getPaymentMethodsForCountry(code: string, apiCountries?: ApiCountry[]): string[] {
  const country = getCountryByCode(code, apiCountries);
  return country ? [...country.paymentMethods] : [];
}

export function formatLocalCurrency(amount: number, countryCode: string, apiCountries?: ApiCountry[]): string {
  const country = getCountryByCode(countryCode, apiCountries);
  return `${getCurrencySymbol(countryCode)}${Math.round(amount).toLocaleString("en-US")} (${country?.currency || getCurrencyCode(countryCode)})`;
}

export function formatCurrency(amount: number, countryCode: string, apiCountries?: ApiCountry[]): string {
  return formatLocalCurrency(fromBaseCurrency(amount, countryCode), countryCode, apiCountries);
}

export { fromBaseCurrency, getBaseSettingForCountry, getCurrencyCode, getCurrencySymbol, PHP_TO_NGN_RATE, toBaseCurrency };
