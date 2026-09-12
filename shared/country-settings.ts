const COUNTRY_SETTING_DEFAULTS: Record<string, Record<string, string>> = {
  NG: {
    minDeposit: "175",
    minWithdrawal: "28",
    signupBonus: "24",
  },
};

/**
 * Resolve a monetary platform setting in the existing PHP ledger unit.
 * Country overrides are suffixed with the country code, for example
 * minDeposit_NG. Philippines continues to use the original global setting.
 */
export function getBaseSettingForCountry(
  settings: Record<string, string>,
  key: string,
  countryCode: string | null | undefined,
  fallback: string,
): string {
  const country = countryCode?.trim().toUpperCase();
  if (country === "NG") {
    return settings[`${key}_NG`]
      || COUNTRY_SETTING_DEFAULTS.NG[key]
      || settings[key]
      || fallback;
  }
  return settings[key] || fallback;
}