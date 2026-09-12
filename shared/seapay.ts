/**
 * The small, public set of Nigerian banks exposed by the app.
 *
 * These are SeaPay payout routing codes, not pay-in `pay_type` values.  The
 * latter are merchant-channel specific and must only come from SeaPay.
 */
export const SEAPAY_NIGERIA_BANKS = [
  { name: "PalmPay", code: "PALMPAY" },
  { name: "Access Bank", code: "000014" },
  { name: "GT Bank", code: "000013" },
  { name: "UBA", code: "000004" },
  { name: "Zenith Bank", code: "000015" },
] as const;

export type SeapayNigeriaBank = (typeof SEAPAY_NIGERIA_BANKS)[number];