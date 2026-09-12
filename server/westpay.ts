import crypto from "crypto";

const WESTPAY_BASE = "https://westpay.cfd";

/** Map app country code → WestPay display country name */
export const WESTPAY_COUNTRY_NAMES: Record<string, string> = {
  TG: "Togo",
  BJ: "Benin",
  BF: "Burkina Faso",
  CI: "Cote d'Ivoire",
  SN: "Senegal",
  ML: "Mali",
  CM: "Cameroon",
  CG: "Congo Brazzaville",
  COG: "Congo Brazzaville",
  CD: "Congo RDC",
  COD: "Congo RDC",
  GA: "Gabon",
  GN: "Guinea",
  NE: "Niger",
  KE: "Kenya",
  GH: "Ghana",
  NG: "Nigeria",
  PK: "Pakistan",
  PH: "Philippines",
  IN: "India",
};

/** Map app country code → Replit Secret env var for per-country withdrawal API key */
const API_KEY_ENV: Record<string, string> = {
  TG:  "WESTPAY_API_KEY_TG",
  BJ:  "WESTPAY_API_KEY_BJ",
  BF:  "WESTPAY_API_KEY_BF",
  CI:  "WESTPAY_API_KEY_CI",
  SN:  "WESTPAY_API_KEY_SN",
  ML:  "WESTPAY_API_KEY_ML",
  CM:  "WESTPAY_API_KEY_CM",
  CG:  "WESTPAY_API_KEY_CG",
  COG: "WESTPAY_API_KEY_CG",
  CD:  "WESTPAY_API_KEY_CD",
  COD: "WESTPAY_API_KEY_CD",
  GA:  "WESTPAY_API_KEY_GA",
  GN:  "WESTPAY_API_KEY_GN",
  NE:  "WESTPAY_API_KEY_NE",
  KE:  "WESTPAY_API_KEY_KE",
  GH:  "WESTPAY_API_KEY_GH",
  NG:  "WESTPAY_API_KEY_NG",
};

/** Phone prefix per country (for MSISDN formatting in withdrawals) */
const PHONE_PREFIX: Record<string, string> = {
  TG:  "228", BJ:  "229", BF:  "226", CI:  "225",
  SN:  "221", ML:  "223", CM:  "237", CG:  "242",
  COG: "242", CD:  "243", COD: "243", GA:  "241",
  GN:  "224", NE:  "227", KE:  "254", GH:  "233",
  NG:  "234", PK:  "92",  PH:  "63",  IN:  "91",
};

export function getCountryName(code: string): string {
  return WESTPAY_COUNTRY_NAMES[code] || code;
}

export function getMerchantSlug(): string {
  return process.env.WESTPAY_MERCHANT_SLUG || "";
}

export function getApiKeyForCountry(code: string): string {
  const envVar = API_KEY_ENV[code];
  return envVar ? (process.env[envVar] || "") : "";
}

/** Format a local phone number to full msisdn (no +) required by WestPay */
export function formatMsisdn(phone: string, countryCode: string): string {
  const cleaned = phone.replace(/[\s\-\+]/g, "");
  const prefix = PHONE_PREFIX[countryCode] || "";
  if (!prefix) return cleaned;
  if (cleaned.startsWith(prefix)) return cleaned;
  if (cleaned.startsWith("0")) return `${prefix}${cleaned.substring(1)}`;
  return `${prefix}${cleaned}`;
}

/**
 * Build the WestPay hosted-payment page URL.
 * The user is redirected there; they enter their phone on the WestPay page
 * and validate the USSD push on their device.
 */
export function buildPaymentUrl(params: {
  amount: number;
  countryCode: string;
  redirectUrl: string;
}): string {
  const slug = getMerchantSlug();
  if (!slug) throw new Error("WESTPAY_MERCHANT_SLUG is not configured");
  const url = new URL(`${WESTPAY_BASE}/pay`);
  url.searchParams.set("merchant", slug);
  url.searchParams.set("amount", String(params.amount));
  url.searchParams.set("country", getCountryName(params.countryCode));
  url.searchParams.set("redirect", params.redirectUrl);
  return url.toString();
}

export interface TransferResult {
  success: boolean;
  reference?: string;
  fees?: number;
  error?: string;
}

/**
 * Send money to a Mobile Money wallet via WestPay.
 * Uses the per-country API key (X-API-KEY header).
 */
export async function transfer(params: {
  countryCode: string;
  msisdn: string;       // full number with dial prefix, no +
  amount: number;
  firstName: string;
  lastName: string;
}): Promise<TransferResult> {
  const apiKey = getApiKeyForCountry(params.countryCode);
  if (!apiKey) {
    return {
      success: false,
      error: `WestPay API key missing for ${params.countryCode} — configure WESTPAY_API_KEY_${params.countryCode} in Secrets`,
    };
  }
  try {
    const res = await fetch(`${WESTPAY_BASE}/api/merchant/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        country: getCountryName(params.countryCode),
        msisdn: params.msisdn,
        amount: params.amount,
        firstName: params.firstName,
        lastName: params.lastName,
      }),
    });
    const data = await res.json() as any;
    if (res.ok) return { success: true, reference: data.reference, fees: data.fees };
    return { success: false, error: data.message || `Error ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message || "WestPay network error" };
  }
}

/**
 * Verify a WestPay webhook signature.
 * WestPay sends HMAC-SHA256 of the raw JSON body in X-RobotPay-Signature header.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
