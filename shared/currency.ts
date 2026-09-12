// Monetary values are stored in the platform's existing PHP base unit.
// Country-facing amounts are converted at the boundary using this frozen rate.
// Source: open.er-api.com, updated 2026-09-01 (1 PHP = 21.18 NGN).
export const PHP_TO_NGN_RATE = 21.18;
export const BASE_CURRENCY = "PHP" as const;

export const SUPPORTED_COUNTRY_CODES = ["PH", "NG"] as const;
export type SupportedCountryCode = typeof SUPPORTED_COUNTRY_CODES[number];

export const COUNTRY_CURRENCY = {
  PH: { code: "PHP", symbol: "₱", name: "Philippine peso" },
  NG: { code: "NGN", symbol: "₦", name: "Nigerian naira" },
} as const;

export function getCurrencyCode(countryCode: string | null | undefined): string {
  return countryCode?.toUpperCase() === "NG" ? COUNTRY_CURRENCY.NG.code : COUNTRY_CURRENCY.PH.code;
}

export function getCurrencySymbol(countryCode: string | null | undefined): string {
  return countryCode?.toUpperCase() === "NG" ? COUNTRY_CURRENCY.NG.symbol : COUNTRY_CURRENCY.PH.symbol;
}

/** Convert an existing/base PHP amount to the selected country's whole currency unit. */
export function fromBaseCurrency(amount: number, countryCode: string | null | undefined): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(countryCode?.toUpperCase() === "NG" ? amount * PHP_TO_NGN_RATE : amount);
}

/** Convert a country-facing whole-unit amount back to the existing PHP ledger unit. */
export function toBaseCurrency(amount: number, countryCode: string | null | undefined): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(countryCode?.toUpperCase() === "NG" ? amount / PHP_TO_NGN_RATE : amount);
}
