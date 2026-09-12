export function formatCompanyProductName(name: string | undefined, productId?: number) {
  const originalName = name?.trim() || "";
  const numberFromName = originalName.match(/\d+/)?.[0];
  const productNumber = numberFromName || (productId ? String(productId) : "");

  if (productNumber && /vip|omni|teld/i.test(originalName)) {
    return `TELD${productNumber}`;
  }

  return originalName.replace(/\s*Omni(?:\s+One)?(?:\s+VR)?\s*/gi, " ").trim() || "TELD product";
}