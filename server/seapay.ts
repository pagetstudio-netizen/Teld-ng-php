import crypto from "crypto";
import { SEAPAY_NIGERIA_BANKS } from "@shared/seapay";

const SEAPAY_API_BASE = process.env.SEAPAY_API_BASE || "https://api.seapayglb.me";
const publicAppUrl = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
export const DEFAULT_SEAPAY_NOTIFY_URL = publicAppUrl
  ? `${publicAppUrl}/api/seapay/callback/deposit`
  : "http://autelenergy.cc/api/seapay/callback/deposit";

type SeapayConfig = {
  country: string;
  apiBase: string;
  merchantId?: string;
  apiKey?: string;
  apiSecret?: string;
};

function normalizedCountry(country: string): string {
  return country.trim().toUpperCase();
}

function configuredValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getSeapayConfig(country: string): SeapayConfig {
  const countryCode = normalizedCountry(country);
  const prefix = countryCode ? `SEAPAY_${countryCode}_` : "SEAPAY_";
  return {
    country: countryCode,
    apiBase: configuredValue(`${prefix}API_BASE`) || configuredValue("SEAPAY_API_BASE") || SEAPAY_API_BASE,
    merchantId: configuredValue(`${prefix}MERCHANT_ID`) || configuredValue("SEAPAY_MERCHANT_ID"),
    apiKey: configuredValue(`${prefix}API_KEY`) || configuredValue("SEAPAY_API_KEY"),
    apiSecret: configuredValue(`${prefix}API_SECRET`) || configuredValue("SEAPAY_API_SECRET"),
  };
}

export function getSeapayMerchantId(country: string): string | undefined {
  return getSeapayConfig(country).merchantId;
}

export function getSeapayApiKey(country: string): string | undefined {
  return getSeapayConfig(country).apiKey;
}

export function getSeapayApiSecret(country: string): string | undefined {
  return getSeapayConfig(country).apiSecret;
}

export function getSeapayNotifyUrl(country: string, kind: "deposit" | "withdrawal"): string {
  const countryCode = normalizedCountry(country);
  const countrySpecific = configuredValue(
    kind === "deposit"
      ? `SEAPAY_${countryCode}_NOTIFY_URL`
      : `SEAPAY_${countryCode}_PAYOUT_NOTIFY_URL`,
  );
  const shared = configuredValue(kind === "deposit" ? "SEAPAY_NOTIFY_URL" : "SEAPAY_PAYOUT_NOTIFY_URL");
  if (countrySpecific) return countrySpecific;
  if (shared) return shared;
  return kind === "deposit"
    ? (countryCode ? DEFAULT_SEAPAY_NOTIFY_URL : DEFAULT_SEAPAY_NOTIFY_URL)
    : DEFAULT_SEAPAY_NOTIFY_URL.replace("/deposit", "/withdrawal");
}

export type SeaPayResponse<T> = {
  code?: number;
  msg?: string;
  data?: T;
};

export type SeaPayPayinData = {
  order_no: string;
  merchant_order_no: string;
  amount: string;
  currency: string;
  pay_url: string;
  expires_at?: string;
};

export type SeaPayQueryData = {
  order_no?: string;
  merchant_order_no?: string;
  amount?: string;
  currency?: string;
  status?: string;
  created_at?: string;
  completed_at?: string;
};

export function isSeapayConfigured(country = ""): boolean {
  const config = getSeapayConfig(country);
  return Boolean(config.merchantId && config.apiKey);
}

export function isSeapayEnabled(settings: Record<string, string>, country = ""): boolean {
  return (
    (settings.seapayEnabled === "true" || process.env.SEAPAY_ENABLED === "true") &&
    isSeapayConfigured(country)
  );
}

export function isSeapaySupportedCountry(country: string): boolean {
  const configuredCountries = (process.env.SEAPAY_COUNTRIES || "PH")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  return configuredCountries.includes(country.trim().toUpperCase());
}

export function isSeapayPayoutConfigured(country = ""): boolean {
  const config = getSeapayConfig(country);
  return Boolean(config.merchantId && config.apiSecret);
}

export function isSeapayPayoutEnabled(country: string): boolean {
  const configuredCountries = (process.env.SEAPAY_PAYOUT_COUNTRIES || "NG")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  return isSeapayPayoutConfigured(country) && configuredCountries.includes(country.trim().toUpperCase());
}

function getPayTypeMap(country: string): Record<string, unknown> {
  const countryCode = normalizedCountry(country);
  const raw = configuredValue(`SEAPAY_${countryCode}_PAY_TYPES`) || configuredValue("SEAPAY_PAY_TYPES");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error("SEAPAY_PAY_TYPES must be valid JSON");
  }
}

function normalizeOperator(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const PHILIPPINES_PAY_TYPES: Record<string, string> = {
  gcash: "101",
  paymaya: "102",
};

export function getSeapayPayType(country: string, operatorName: string): string | undefined {
  const countryCode = country.trim().toUpperCase();
  const map = getPayTypeMap(countryCode);
  const countryMap = map[countryCode];
  const candidates =
    countryMap && typeof countryMap === "object" && !Array.isArray(countryMap)
      ? countryMap as Record<string, unknown>
      : map;
  const normalizedOperator = normalizeOperator(operatorName);

  // SeaPay's Philippines channels are fixed: 101 is GCash and 102 is
  // PayMaya. Keep this mapping authoritative so a stale environment mapping
  // cannot send a PayMaya selection to the GCash channel.
  if (countryCode === "PH" && PHILIPPINES_PAY_TYPES[normalizedOperator]) {
    return PHILIPPINES_PAY_TYPES[normalizedOperator];
  }

  const entry = Object.entries(candidates).find(([name]) => normalizeOperator(name) === normalizedOperator);
  const value = entry?.[1];
  return value === undefined || value === null || String(value).trim() === "" ? undefined : String(value).trim();
}

export function getSeapayPayoutBankCode(country: string, paymentMethod: string): string | undefined {
  const countryCode = normalizedCountry(country);
  const raw = configuredValue(`SEAPAY_${countryCode}_PAYOUT_BANK_CODES`) ||
    configuredValue("SEAPAY_PAYOUT_BANK_CODES");
  if (raw) {
    let map: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      map = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      throw new Error("SEAPAY_PAYOUT_BANK_CODES must be valid JSON");
    }

    const countryMap = map[countryCode];
    const candidates =
      countryMap && typeof countryMap === "object" && !Array.isArray(countryMap)
        ? countryMap as Record<string, unknown>
        : map;
    const normalizedMethod = normalizeOperator(paymentMethod);
    const entry = Object.entries(candidates).find(([name]) => normalizeOperator(name) === normalizedMethod);
    const value = entry?.[1];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  // SeaPay publishes these NGN bank routing codes in its payout docs. Keep
  // pay-in channel routing separate: this fallback is intentionally payout
  // only and is never consulted by getSeapayPayType().
  if (countryCode === "NG") {
    const normalizedMethod = normalizeOperator(paymentMethod);
    return SEAPAY_NIGERIA_BANKS.find((bank) => normalizeOperator(bank.name) === normalizedMethod)?.code;
  }
  return undefined;
}

export function buildSeapaySignature(params: Record<string, unknown>, key: string): string {
  const query = Object.entries(params)
    .filter(([name, value]) => name !== "sign" && name !== "sign_type" && value !== "" && value !== null && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right, "en", { sensitivity: "variant" }))
    .map(([name, value]) => `${name}=${String(value)}`)
    .join("&");
  return crypto.createHash("md5").update(`${query}&key=${key}`).digest("hex");
}

function configuredCountryCodes(): string[] {
  const configured = [
    ...(process.env.SEAPAY_COUNTRIES || "").split(","),
    ...(process.env.SEAPAY_PAYOUT_COUNTRIES || "").split(","),
  ]
    .map((value) => normalizedCountry(value))
    .filter(Boolean);
  return Array.from(new Set(["PH", "NG", ...configured]));
}

function findConfigForMerchant(
  merchantId: string,
  credential: "apiKey" | "apiSecret",
): SeapayConfig | undefined {
  const normalizedMerchantId = merchantId.trim();
  if (!normalizedMerchantId) return undefined;
  return configuredCountryCodes()
    .map((country) => getSeapayConfig(country))
    .find((config) => config.merchantId === normalizedMerchantId && Boolean(config[credential]));
}

export function isKnownSeapayMerchant(merchantId: unknown, credential: "apiKey" | "apiSecret"): boolean {
  return typeof merchantId === "string" && Boolean(findConfigForMerchant(merchantId, credential));
}

function timingSafeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left.toLowerCase());
  const rightBuffer = Buffer.from(right.toLowerCase());
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifySeapaySignature(payload: Record<string, unknown>, signature?: string): boolean {
  const config = findConfigForMerchant(String(payload.merchant_id || ""), "apiKey");
  const key = config?.apiKey;
  if (!key || !signature) return false;
  return timingSafeEqualHex(buildSeapaySignature(payload, key), signature);
}

export function buildSeapayPayinPayload(params: {
  merchantOrderNo: string;
  amount: number;
  currency: string;
  payType?: string;
  notifyUrl: string;
  country?: string;
}): Record<string, unknown> {
  const config = getSeapayConfig(params.country || "");
  const payload: Record<string, unknown> = {
    merchant_id: config.merchantId || "",
    merchant_order_no: params.merchantOrderNo,
    amount: params.amount.toFixed(2),
    currency: params.currency,
    notify_url: params.notifyUrl,
  };
  if (params.payType) payload.pay_type = params.payType;
  return payload;
}

async function post<T>(apiBase: string, path: string, payload: Record<string, unknown>): Promise<SeaPayResponse<T>> {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({})) as SeaPayResponse<T>;
  if (!response.ok || String(body.code) !== "200") {
    throw new Error(body.msg || `SeaPay request failed with HTTP ${response.status}`);
  }
  return body;
}

export async function createPayin(params: {
  merchantOrderNo: string;
  amount: number;
  currency: string;
  payType?: string;
  notifyUrl: string;
  country: string;
}): Promise<SeaPayPayinData> {
  const config = getSeapayConfig(params.country);
  const merchantId = config.merchantId;
  const apiKey = config.apiKey;
  if (!merchantId || !apiKey) throw new Error("SeaPay is not configured");

  const payload = buildSeapayPayinPayload(params);
  payload.merchant_id = merchantId;
  payload.sign = buildSeapaySignature(payload, apiKey);

  const result = await post<SeaPayPayinData>(config.apiBase, "/api/merchant/payin", payload);
  if (!result.data?.pay_url || !result.data.merchant_order_no) {
    throw new Error("SeaPay returned an incomplete payment response");
  }
  return result.data;
}

export async function queryPayin(merchantOrderNo: string, country: string): Promise<SeaPayQueryData> {
  const config = getSeapayConfig(country);
  const merchantId = config.merchantId;
  const apiKey = config.apiKey;
  if (!merchantId || !apiKey) throw new Error("SeaPay is not configured");

  const payload: Record<string, unknown> = {
    merchant_id: merchantId,
    merchant_order_no: merchantOrderNo,
  };
  payload.sign = buildSeapaySignature(payload, apiKey);
  const result = await post<SeaPayQueryData>(config.apiBase, "/api/merchant/query/payin", payload);
  return result.data || {};
}

export type SeaPayPayoutData = {
  order_no?: string;
  merchant_order_no?: string;
  amount?: string;
  currency?: string;
  status?: string;
};

export function buildSeapayPayoutPayload(params: {
  merchantOrderNo: string;
  amount: number;
  currency: string;
  payeeName: string;
  payeeAccount: string;
  payeeBank: string;
  notifyUrl: string;
  country?: string;
}): Record<string, unknown> {
  const config = getSeapayConfig(params.country || "");
  return {
    merchant_id: config.merchantId || "",
    merchant_order_no: params.merchantOrderNo,
    amount: params.amount.toFixed(2),
    currency: params.currency,
    payee_name: params.payeeName,
    payee_account: params.payeeAccount,
    payee_bank: params.payeeBank,
    notify_url: params.notifyUrl,
  };
}

export async function createPayout(params: {
  merchantOrderNo: string;
  amount: number;
  currency: string;
  payeeName: string;
  payeeAccount: string;
  payeeBank: string;
  notifyUrl: string;
  country: string;
}): Promise<SeaPayPayoutData> {
  const config = getSeapayConfig(params.country);
  const merchantId = config.merchantId;
  const apiSecret = config.apiSecret;
  if (!merchantId || !apiSecret) throw new Error("SeaPay payout is not configured");

  const payload = buildSeapayPayoutPayload(params);
  payload.merchant_id = merchantId;
  payload.sign = buildSeapaySignature(payload, apiSecret);
  const result = await post<SeaPayPayoutData>(config.apiBase, "/api/merchant/payout", payload);
  if (!result.data?.merchant_order_no) throw new Error("SeaPay returned an incomplete payout response");
  return result.data;
}

export function verifySeapayPayoutSignature(payload: Record<string, unknown>, signature?: string): boolean {
  const config = findConfigForMerchant(String(payload.merchant_id || ""), "apiSecret");
  const apiSecret = config?.apiSecret;
  if (!apiSecret || !signature) return false;
  return timingSafeEqualHex(buildSeapaySignature(payload, apiSecret), signature);
}

export async function queryPayout(merchantOrderNo: string, country: string): Promise<SeaPayPayoutData> {
  const config = getSeapayConfig(country);
  const merchantId = config.merchantId;
  const apiSecret = config.apiSecret;
  if (!merchantId || !apiSecret) throw new Error("SeaPay payout is not configured");

  const payload: Record<string, unknown> = {
    merchant_id: merchantId,
    merchant_order_no: merchantOrderNo,
  };
  payload.sign = buildSeapaySignature(payload, apiSecret);
  const result = await post<SeaPayPayoutData>(config.apiBase, "/api/merchant/query/payout", payload);
  return result.data || {};
}

export function mapSeapayStatus(status: string | undefined): "pending" | "approved" | "rejected" {
  switch (status?.toLowerCase()) {
    case "completed":
      return "approved";
    case "failed":
    case "cancelled":
    case "expired":
      return "rejected";
    default:
      return "pending";
  }
}