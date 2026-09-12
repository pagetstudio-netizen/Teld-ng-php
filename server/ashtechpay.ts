const ASHTECHPAY_API_BASE = process.env.ASHTECHPAY_API_BASE || "https://ashtechpay.top";

export interface AshtechCountry {
  code: string;
  name: string;
  currency: string;
  operators: string[];
}

export interface AshtechCollectParams {
  amount: number;
  currency: string;
  phone: string;
  operator: string;
  countryCode: string;
  reference: string;
  notifyUrl: string;
  otp?: string;
}

export interface AshtechCollectResponse {
  transaction_id: string;
  reference: string;
  status: string;
  amount: number;
  credited_amount?: number;
  fee_amount?: number;
  currency: string;
  operator?: string;
  phone?: string;
  country_code?: string;
  wave_url?: string;
  ussd_code?: string | null;
  message?: string;
}

export class AshtechApiError extends Error {
  status: number;
  data: Record<string, any>;

  constructor(status: number, data: Record<string, any>) {
    super(data?.message || data?.error || `AshtechPay HTTP ${status}`);
    this.name = "AshtechApiError";
    this.status = status;
    this.data = data;
  }
}

function getApiKey() {
  const key = process.env.ASHTECHPAY_API_KEY;
  if (!key) throw new Error("AshtechPay is not configured: ASHTECHPAY_API_KEY is missing");
  return key;
}

async function ashtechRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${ASHTECHPAY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AshtechApiError(response.status, data);
  }
  return data;
}

export async function getCountries(): Promise<AshtechCountry[]> {
  const data = await ashtechRequest("/v1/countries");
  return Array.isArray(data) ? data : data.countries || [];
}

export async function collectPayment(params: AshtechCollectParams): Promise<AshtechCollectResponse> {
  return ashtechRequest("/v1/collect", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      phone: params.phone,
      operator: params.operator,
      country_code: params.countryCode,
      reference: params.reference,
      notify_url: params.notifyUrl,
      ...(params.otp ? { otp: params.otp } : {}),
    }),
  });
}

export async function getTransaction(transactionId: string): Promise<AshtechCollectResponse> {
  return ashtechRequest(`/v1/transaction/${encodeURIComponent(transactionId)}`);
}

export function mapAshtechStatus(status: string | undefined): "pending" | "approved" | "rejected" {
  const normalized = String(status || "").toLowerCase();
  if (["success", "completed", "confirmed", "approved"].includes(normalized)) return "approved";
  if (["failed", "expired", "cancelled", "canceled", "rejected"].includes(normalized)) return "rejected";
  return "pending";
}

export function isAshtechConfigured() {
  return Boolean(process.env.ASHTECHPAY_API_KEY);
}