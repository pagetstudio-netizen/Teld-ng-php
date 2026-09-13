import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { timingSafeEqual } from "crypto";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { registerSchema, loginSchema, depositSchema, walletSchema, phoneNumberSchema } from "@shared/schema";
import { z } from "zod";
import ConnectPgSimple from "connect-pg-simple";
import { 
  initiatePayment, 
  verifyPayment, 
  isSoleaspaySupported, 
  mapSoleaspayStatus,
  SOLEASPAY_SERVICE_MAP 
} from "./soleaspay";
import {
  createPayment as sendavapayCreate,
  initiatePayment as sendavapayInitiate,
  submitOtp as sendavapaySubmitOtp,
  retryPayment as sendavapayRetry,
  verifyPayment as sendavapayVerify,
  verifyWebhookSignature as sendavapayVerifySignature,
  mapSendavapayStatus,
  formatPhone as sendavapayFormatPhone,
  getCurrency as sendavapayGetCurrency,
  toSendavapayCountry,
} from "./sendavapay";
import {
  buildPaymentUrl as westpayBuildUrl,
  verifyWebhookSignature as westpayVerifySignature,
  transfer as westpayTransfer,
  formatMsisdn as westpayFormatMsisdn,
} from "./westpay";
import {
  collectPayment as ashtechCollect,
  getCountries as ashtechGetCountries,
  getTransaction as ashtechGetTransaction,
  isAshtechConfigured,
  mapAshtechStatus,
  AshtechApiError,
} from "./ashtechpay";
import {
  createPayin as seapayCreatePayin,
  buildSeapayPayinPayload,
  buildSeapaySignature,
  buildSeapayPayoutPayload,
  getSeapayApiKey,
  getSeapayApiSecret,
  getSeapayNotifyUrl,
  getSeapayPayType,
  getSeapayPayoutBankCode,
  isSeapayEnabled,
  isSeapayPayoutEnabled,
  isKnownSeapayMerchant,
  mapSeapayStatus,
  createPayout as seapayCreatePayout,
  queryPayout as seapayQueryPayout,
  queryPayin as seapayQueryPayin,
  verifySeapaySignature,
  verifySeapayPayoutSignature,
} from "./seapay";
import { formatTelegramValue, sendTelegramMessage, sendTelegramSecurityAlert } from "./telegram";
import express from "express";
import { fromBaseCurrency, getCurrencyCode, toBaseCurrency, SUPPORTED_COUNTRY_CODES } from "@shared/currency";
import { getBaseSettingForCountry } from "@shared/country-settings";

// --- Brute-force protection (in-memory) ---
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const pinAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function getClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function checkBruteForce(req: Request, res: Response): boolean {
  const key = getClientKey(req);
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (record && record.blockedUntil > now) {
    const minutesLeft = Math.ceil((record.blockedUntil - now) / 60000);
    res.status(429).json({ message: `Too many attempts. Try again in ${minutesLeft} minute(s).` });
    return true;
  }
  return false;
}

function recordFailedAttempt(req: Request) {
  const key = getClientKey(req);
  const now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    record.count = 0;
    void sendTelegramSecurityAlert(
      key,
      "Too many attempts. Try again in 15 minute(s).",
    ).catch((error) => console.error("[telegram] security notification failed:", error.message));
  }
  loginAttempts.set(key, record);
}

function clearFailedAttempts(req: Request) {
  loginAttempts.delete(getClientKey(req));
}

function checkPinRateLimit(req: Request, res: Response): boolean {
  const record = pinAttempts.get(getClientKey(req));
  if (record && record.blockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((record.blockedUntil - Date.now()) / 60000);
    res.status(429).json({ message: `Too many PIN attempts. Try again in ${minutesLeft} minute(s).` });
    return true;
  }
  return false;
}

function recordPinFailure(req: Request) {
  const key = getClientKey(req);
  const record = pinAttempts.get(key) || { count: 0, blockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    record.count = 0;
  }
  pinAttempts.set(key, record);
}

function clearPinFailures(req: Request) {
  pinAttempts.delete(getClientKey(req));
}

function getBlockedIps(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function getRouteParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getPublicAppBaseUrl(req: Request): string {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    try {
      const parsedUrl = new URL(configuredUrl);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return parsedUrl.origin;
      }
    } catch {
      console.warn("[app url] Invalid PUBLIC_APP_URL, using the request URL");
    }
  }

  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "https" ? "https" : req.protocol;
  return `${protocol}://${req.get("host")}`;
}
// --- end brute-force protection ---

const ACCESSIBLE_COUNTRY_CODES = new Set(["TG", "PH", "NG", "CI"]);
const AFRICAN_COUNTRY_CODES = new Set([
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG",
  "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN",
  "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "YT", "MA",
  "MZ", "NA", "NE", "NG", "RE", "RW", "SH", "ST", "SN", "SC", "SL", "SO",
  "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW",
]);
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hasValidSameOrigin(req: Request): boolean {
  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "https" || req.protocol === "https" ? "https" : "http";
  const expectedOrigin = `${protocol}://${req.get("host")}`;
  const origin = req.get("origin");
  if (origin) return origin === expectedOrigin;

  const referer = req.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function getEdgeCountry(req: Request): string | null {
  const headerName = process.env.GEOIP_COUNTRY_HEADER?.trim() || "cf-ipcountry";
  const value = req.get(headerName)?.trim().toUpperCase();
  return value && /^[A-Z]{2}$/.test(value) ? value : null;
}

function getRegistrationDefaultCountry(req: Request): "PH" | "NG" {
  const detectedCountry = getEdgeCountry(req);
  return detectedCountry && AFRICAN_COUNTRY_CODES.has(detectedCountry) && detectedCountry !== "PH"
    ? "NG"
    : "PH";
}

function isGeoAllowed(req: Request): boolean {
  if (process.env.GEO_ENFORCE !== "true") return true;
  const edgeCountry = getEdgeCountry(req);
  return edgeCountry !== null && ACCESSIBLE_COUNTRY_CODES.has(edgeCountry);
}

const WITHDRAWAL_TIME_ZONES: Record<string, string> = {
  PH: "Asia/Manila",
  NG: "Africa/Lagos",
};

function getCountryLocalHour(countryCode: string, now = new Date()): number {
  const timeZone = WITHDRAWAL_TIME_ZONES[countryCode.trim().toUpperCase()] || "Asia/Manila";
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).find((part) => part.type === "hour");
  return Number(hourPart?.value || "0");
}

function isWithinWithdrawalHours(countryCode: string, startHour: number, endHour: number): boolean {
  const currentHour = getCountryLocalHour(countryCode);
  return currentHour >= startHour && currentHour < endHour;
}

function publicUser(user: any) {
  const { password: _password, adminPin: _adminPin, ...safeUser } = user;
  return safeUser;
}

function regenerateAuthenticatedSession(req: Request, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = userId;
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

function safePinEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function amountForCountry(amount: number, countryCode: string): string {
  return `${fromBaseCurrency(amount, countryCode).toLocaleString("en-US")} ${getCurrencyCode(countryCode)}`;
}

async function creditApprovedDeposit(deposit: { id: number; userId: number; amount: number }) {
  const user = await storage.getUser(deposit.userId);
  if (!user) return;

  const credited = await storage.creditDeposit(
    user.id,
    deposit.amount,
    `Deposit #${deposit.id} approved`,
  );
  if (!credited) return;
  await storage.processDepositReferralCommissions(user.id, deposit.amount);
  void sendTelegramMessage(
    [
      "✅ <b>Deposit approved</b>",
      `User: ${formatTelegramValue(user.fullName)}`,
      `Amount: <b>${formatTelegramValue(amountForCountry(deposit.amount, user.country))}</b>`,
      `Reference: ${formatTelegramValue(deposit.id)}`,
      `Country: ${formatTelegramValue(user.country)}`,
    ].join("\n"),
  ).catch((error) => console.error("[telegram] deposit notification failed:", error.message));
}

function matchesSeapayDepositAmount(
  deposit: { amount: number; country: string },
  providerAmount: unknown,
  providerCurrency: unknown,
): boolean {
  const amount = Number(providerAmount);
  const currency = String(providerCurrency || "").trim().toUpperCase();
  const expectedAmount = fromBaseCurrency(deposit.amount, deposit.country);
  return Number.isFinite(amount)
    && Math.abs(amount - expectedAmount) < 0.01
    && currency === getCurrencyCode(deposit.country).toUpperCase();
}

async function refundWithdrawal(withdrawal: { id?: number; userId: number; amount: number }) {
  const refunded = await storage.refundWithdrawal(
    withdrawal.userId,
    withdrawal.amount,
    withdrawal.id ? `Withdrawal #${withdrawal.id} refunded` : "Withdrawal refunded",
  );
  if (!refunded) throw new Error("Unable to refund withdrawal");
}

async function sendWithdrawalToSeapay(withdrawalId: number, processedBy: number) {
  const allWithdrawals = await storage.getWithdrawals();
  const withdrawalData = allWithdrawals.find((item) => item.id === withdrawalId);
  if (!withdrawalData) throw Object.assign(new Error("Withdrawal not found"), { statusCode: 404 });
  if (!isSeapayPayoutEnabled(withdrawalData.country)) {
    throw Object.assign(new Error("SeaPay payout is not configured for this country"), { statusCode: 400 });
  }
  const payeeBank = getSeapayPayoutBankCode(withdrawalData.country, withdrawalData.paymentMethod);
  if (!payeeBank) {
    throw Object.assign(new Error(`No SeaPay payout bank code is configured for ${withdrawalData.paymentMethod}`), { statusCode: 400 });
  }

  const merchantOrderNo = `Intel-W-${Date.now()}-${withdrawalData.id}`;
  const notifyUrl = getSeapayNotifyUrl(withdrawalData.country, "withdrawal");
  const payload = buildSeapayPayoutPayload({
    merchantOrderNo,
    amount: fromBaseCurrency(withdrawalData.netAmount, withdrawalData.country),
    currency: getCurrencyCode(withdrawalData.country),
    payeeName: withdrawalData.accountName,
    payeeAccount: withdrawalData.accountNumber,
    payeeBank,
    notifyUrl,
    country: withdrawalData.country,
  });
  const claimed = await storage.claimWithdrawalForSeapay(withdrawalId, {
    status: "processing",
    processedBy,
    processedAt: null,
    seapayPayoutReference: merchantOrderNo,
    seapayPayoutRequestPayload: JSON.stringify(payload),
  });
  if (!claimed) {
    throw Object.assign(new Error("This withdrawal is already being processed or unavailable"), { statusCode: 409 });
  }

  try {
    const payout = await seapayCreatePayout({
      merchantOrderNo,
      amount: fromBaseCurrency(withdrawalData.netAmount, withdrawalData.country),
      currency: getCurrencyCode(withdrawalData.country),
      payeeName: withdrawalData.accountName,
      payeeAccount: withdrawalData.accountNumber,
      payeeBank,
      notifyUrl,
      country: withdrawalData.country,
    });
    const payoutStatus = mapSeapayStatus(payout.status);
    if (payoutStatus === "approved") {
      await storage.claimWithdrawalApproval(withdrawalId, {
        status: "approved",
        processedAt: new Date(),
        seapayPayoutOrderId: payout.order_no || null,
      });
    } else if (payoutStatus === "rejected") {
      const rejected = await storage.claimWithdrawalRejection(withdrawalId, {
        status: "rejected",
        processedAt: new Date(),
        seapayPayoutOrderId: payout.order_no || null,
      });
      if (rejected) await refundWithdrawal(withdrawalData);
    } else {
      await storage.updateWithdrawal(withdrawalId, {
        seapayPayoutOrderId: payout.order_no || null,
      });
    }
    return await storage.getWithdrawalBySeapayPayoutReference(merchantOrderNo);
  } catch (error) {
    const rejected = await storage.claimWithdrawalRejection(withdrawalId, { status: "rejected", processedAt: new Date() });
    if (rejected) await refundWithdrawal(withdrawalData);
    throw error;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const PgSession = ConnectPgSimple(session);
const sessionDatabaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionDatabaseUrl) {
  throw new Error("No database URL configured for session storage.");
}
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be configured.");
}

const SENSITIVE_SETTING_KEYS = new Set([
  "sendavapayWebhookSecret",
  "omnipayCallbackKey",
  "westpayWebhookSecret",
  "ashtechWebhookSecret",
]);
const PUBLIC_SETTING_KEYS = new Set([
  "supportLink", "supportType", "supportLabel",
  "support2Link", "support2Type", "support2Label",
  "channelLink", "channelType", "channelLabel",
  "groupLink", "groupType", "groupLabel", "noticeText",
  "supportEnabled", "support2Enabled", "channelEnabled", "groupEnabled",
  "signupBonus", "minDeposit", "minWithdrawal", "withdrawalFees",
  "signupBonus_NG", "minDeposit_NG", "minWithdrawal_NG",
  "maxWithdrawalsPerDay", "withdrawalStartHour", "withdrawalEndHour",
  "level1Commission", "level2Commission", "level3Commission",
  "sendavapayEnabled", "sendavapayChannelName",
  "westpayEnabled", "westpayChannelName", "westpayCountries",
  "seapayEnabled", "seapayCountries", "seapayChannelName",
  "ashtechEnabled", "ashtechChannelName", "ashtechCountries",
]);
const ADMIN_SETTING_KEYS = new Set([
  ...Array.from(PUBLIC_SETTING_KEYS),
]);
const MASKED_SETTING_VALUE = "********";

function publicSettings(settings: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => PUBLIC_SETTING_KEYS.has(key)),
  );
}

function adminSettings(settings: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(settings)
      .filter(([key]) => ADMIN_SETTING_KEYS.has(key))
      .map(([key, value]) => [
      key,
      SENSITIVE_SETTING_KEYS.has(key) && value ? MASKED_SETTING_VALUE : value,
      ]),
  );
}

function validatePhone(value: unknown, fieldName: string): string {
  const result = phoneNumberSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${fieldName} is invalid`);
  }
  return result.data;
}

function parseCountryOperators(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((operator): operator is string => typeof operator === "string" && operator.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function normalizeCountryOperators(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return undefined;
    const operators = parsed
      .map((operator) => String(operator).trim())
      .filter(Boolean)
      .filter((operator, index, list) => list.indexOf(operator) === index);
    return JSON.stringify(operators);
  } catch {
    return undefined;
  }
}

async function getActiveCountry(code: unknown) {
  if (typeof code !== "string") return undefined;
  const normalizedCode = code.trim().toUpperCase();
  if (!SUPPORTED_COUNTRY_CODES.includes(normalizedCode as typeof SUPPORTED_COUNTRY_CODES[number])) return undefined;
  const countries = await storage.getActiveCountries();
  return countries.find((country) => country.code === normalizedCode);
}

async function isActiveCountryOperator(countryCode: unknown, operator: unknown): Promise<boolean> {
  if (typeof operator !== "string") return false;
  const country = await getActiveCountry(countryCode);
  if (!country) return false;
  const normalized = operator.trim().toLocaleLowerCase();
  return parseCountryOperators(country.operators).some((item) => item.trim().toLocaleLowerCase() === normalized);
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    if (user.isBanned) return res.status(403).json({ message: "Account suspended" });
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user?.isAdmin) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
}

async function requireBanker(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user?.isAdmin && !user?.isBanker) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy for production HTTPS (Replit deployment)
  app.set("trust proxy", 1);

  app.use(
    session({
      store: new PgSession({
        conString: sessionDatabaseUrl,
        tableName: "session",
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 60,
      }),
       secret: sessionSecret as string,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
         sameSite: "lax",
      },
    })
  );

  app.use((req, res, next) => {
    if (!isGeoAllowed(req)) {
      return res.status(403).json({ message: "This service is not available in your country" });
    }
    next();
  });

  app.get("/api/registration-default-country", (req, res) => {
    const detectedCountry = getEdgeCountry(req);
    res.json({
      country: getRegistrationDefaultCountry(req),
      detectedCountry,
    });
  });

  app.use((req, res, next) => {
    if (
      !req.path.startsWith("/api") ||
      !STATE_CHANGING_METHODS.has(req.method) ||
      req.path.startsWith("/api/webhooks/") ||
      req.path.startsWith("/api/seapay/callback")
    ) {
      return next();
    }
    if (req.session.userId && !hasValidSameOrigin(req)) {
      return res.status(403).json({ message: "Invalid request origin" });
    }
    next();
  });

  app.use(async (req, res, next) => {
    try {
      const blockedIps = getBlockedIps(await storage.getSetting("blockedIps"));
      if (blockedIps.includes(getClientKey(req))) {
        return res.status(403).json({ message: "Access blocked for this IP address" });
      }
      next();
    } catch (error) {
      console.error("[security] IP block check failed:", error);
      next();
    }
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      if (!await getActiveCountry(data.country)) {
        return res.status(400).json({ message: "This country is not currently available" });
      }
      
      const existing = await storage.getUserByPhone(data.phone, data.country);
      if (existing) {
        return res.status(400).json({ message: "This number is already in use" });
      }

      let referredBy: string | undefined;
      if (data.invitationCode && data.invitationCode.trim()) {
        const cleanCode = data.invitationCode.trim().toUpperCase();
        const referrer = await storage.getUserByReferralCode(cleanCode);
        if (!referrer) {
         return res.status(400).json({ message: "Invalid invitation code" });
        }
        referredBy = cleanCode;
      }

      const user = await storage.createUser({
        fullName: data.fullName,
        phone: data.phone,
        country: data.country,
        password: data.password,
        referredBy,
      });

       await regenerateAuthenticatedSession(req, user.id);
       res.json({ user: publicUser(user) });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    if (checkBruteForce(req, res)) return;
    try {
      const data = loginSchema.parse(req.body);
      if (!await getActiveCountry(data.country)) {
        return res.status(400).json({ message: "This country is not currently available" });
      }
      
      let user = await storage.getUserByPhone(data.phone, data.country);

      // Administrators may select any country at login. Regular users must
      // still authenticate with the country saved on their account.
      if (!user) {
        const adminCandidate = await storage.getUserByPhoneAnyCountry(data.phone);
        if (adminCandidate?.isAdmin) {
          user = adminCandidate;
        }
      }

      if (!user) {
        recordFailedAttempt(req);
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(data.password, user.password);
      if (!validPassword) {
        recordFailedAttempt(req);
        return res.status(400).json({ message: "Invalid credentials" });
      }

      if (user.isBanned) {
        return res.status(403).json({ message: "Account suspended" });
      }

      clearFailedAttempts(req);
       await regenerateAuthenticatedSession(req, user.id);
      if (user.isAdmin) {
        void sendTelegramMessage(
          [
            "🔐 <b>Connexion administrateur</b>",
            `Administrateur : ${formatTelegramValue(user.fullName)}`,
            `Country: ${formatTelegramValue(user.country)}`,
            `IP address: ${formatTelegramValue(getClientKey(req))}`,
          ].join("\n"),
        ).catch((error) => console.error("[telegram] admin login notification failed:", error.message));
      }
       res.json({ user: publicUser(user) });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (user.isBanned) {
      req.session.destroy(() => undefined);
      return res.status(403).json({ message: "Account suspended" });
    }
    res.json({ user: publicUser(user) });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
      if (error) return res.status(500).json({ message: "Unable to end session" });
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.post("/api/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Please fill in all fields" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "The new password must be at least 6 characters" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  // Products
  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getProducts();
      const userProductsList = await storage.getUserProducts(req.session.userId!);
      const user = await storage.getUser(req.session.userId!);
      
      const productCounts = new Map<number, number>();
      userProductsList.forEach(up => {
        if (up.isActive) {
          productCounts.set(up.productId, (productCounts.get(up.productId) || 0) + 1);
        }
      });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const canClaimFree = !user?.lastFreeProductClaim || 
        new Date(user.lastFreeProductClaim) < today;

      const productsWithOwnership = products.map(p => ({
        ...p,
        isOwned: productCounts.has(p.id),
        ownedCount: productCounts.get(p.id) || 0,
        canClaimFree: p.isFree && canClaimFree,
      }));

      res.json(productsWithOwnership);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products/:id/purchase", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(getRouteParam(req, "id"));
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      if (product.isFree) {
        return res.status(400).json({ message: "Use /claim-free for this product" });
      }

      const userProduct = await storage.purchaseProduct(req.session.userId!, productId);
      res.json(userProduct);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/products/:id/claim-free", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(getRouteParam(req, "id"));
      const product = await storage.getProduct(productId);
      
      if (!product || !product.isFree) {
        return res.status(400).json({ message: "Invalid product" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const claimed = await storage.claimFreeProduct(user.id, product.dailyEarnings);
      if (!claimed) return res.status(400).json({ message: "Already claimed today" });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get user's purchased products
  app.get("/api/user/products", requireAuth, async (req, res) => {
    try {
      const userProductsList = await storage.getAllUserProducts(req.session.userId!);
      
      const formattedProducts = userProductsList.map(up => ({
        id: up.userProduct.id,
        productId: up.userProduct.productId,
        purchasedAt: up.userProduct.purchaseDate,
        daysRemaining: up.userProduct.daysRemaining,
        totalEarned: up.userProduct.totalEarned,
        status: up.userProduct.isActive ? 'active' : 'completed',
        product: up.product
      }));
      
      res.json(formattedProducts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Collect earnings for user (manual trigger)
  app.post("/api/user/collect-earnings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { totalCollected, productsCollected } = await storage.processEarnings(userId);

      const updatedUser = await storage.getUser(userId);
      res.json({ 
        success: true, 
        collected: totalCollected,
        productsCollected,
        newBalance: updatedUser?.balance || "0"
      });
    } catch (error: any) {
      console.error("Collect earnings error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Payment Channels
  app.get("/api/payment-channels", requireAuth, async (req, res) => {
    try {
      const channels = await storage.getPaymentChannels();
      res.json(channels.map((channel) => ({ ...channel, gateway: null })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Soleaspay supported services
  app.get("/api/soleaspay/services", requireAuth, async (req, res) => {
    try {
      res.json({ enabled: false, services: {}, enabledCountries: [] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Staking Products (public)
  app.get("/api/staking/products", requireAuth, async (req, res) => {
    try {
      const all = await storage.getActiveStakingProducts();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/staking/purchase/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req, "id"));
      const staking = await storage.purchaseStaking(req.session.userId!, id);
      res.json(staking);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/staking/my", requireAuth, async (req, res) => {
    try {
      const stakings = await storage.getUserStakings(req.session.userId!);
      res.json(stakings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin Staking
  app.get("/api/admin/staking/products", requireAdmin, async (req, res) => {
    try {
      const all = await storage.getStakingProducts();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/staking/products", requireAdmin, async (req, res) => {
    try {
      const { name, description, price, returnAmount, lockDays, launchDate, imageUrl, isActive } = req.body;
      if (!name || !price || !returnAmount || !lockDays) {
        return res.status(400).json({ message: "Required fields: name, price, return, duration" });
      }
      const sp = await storage.createStakingProduct({
        name, description: description || null,
        price: parseInt(price),
        returnAmount: parseInt(returnAmount),
        lockDays: parseInt(lockDays),
        launchDate: launchDate ? new Date(launchDate) : null,
        imageUrl: imageUrl || null,
        isActive: isActive !== false,
        createdBy: req.session.userId,
      });
      res.json(sp);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/admin/staking/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req, "id"));
      const { name, description, price, returnAmount, lockDays, launchDate, imageUrl, isActive } = req.body;
      const sp = await storage.updateStakingProduct(id, {
        name, description,
        price: price !== undefined ? parseInt(price) : undefined,
        returnAmount: returnAmount !== undefined ? parseInt(returnAmount) : undefined,
        lockDays: lockDays !== undefined ? parseInt(lockDays) : undefined,
        launchDate: launchDate ? new Date(launchDate) : (launchDate === null ? null : undefined),
        imageUrl, isActive,
      });
      res.json(sp);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/staking/products/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteStakingProduct(parseInt(getRouteParam(req, "id")));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/staking/stakings", requireAdmin, async (req, res) => {
    try {
      const all = await storage.getAllUserStakings();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Payment Numbers (public — filtered by country)
  app.get("/api/payment-numbers", requireAuth, async (req, res) => {
    try {
      const country = String(req.query.country || "").toUpperCase();
      if (!await getActiveCountry(country)) {
        return res.status(400).json({ message: "Country unavailable" });
      }
      res.json(await storage.getPaymentNumbersByCountry(country));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin Payment Numbers CRUD
  app.get("/api/admin/payment-numbers", requireAdmin, async (req, res) => {
    try {
      const nums = await storage.getPaymentNumbers();
      res.json(nums);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/payment-numbers", requireAdmin, async (req, res) => {
    try {
      const { ownerName, phone, operatorName, country, logoUrl, isActive } = req.body;
      const countryCode = String(country || "").trim().toUpperCase();
      if (!ownerName || !phone || !operatorName || !await getActiveCountry(countryCode)) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (!await isActiveCountryOperator(countryCode, operatorName)) {
        return res.status(400).json({ message: "Add this operator to the country configuration first" });
      }
      const normalizedPhone = validatePhone(phone, "Number");
      const num = await storage.createPaymentNumber({
        ownerName: String(ownerName).trim().slice(0, 100),
        phone: normalizedPhone,
        operatorName: String(operatorName).trim().slice(0, 60),
        country: countryCode,
        logoUrl: logoUrl || null,
        isActive: isActive !== false,
        createdBy: req.session.userId,
      });
      res.json(num);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/admin/payment-numbers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req, "id"));
      const { ownerName, phone, operatorName, country, logoUrl, isActive } = req.body;
      const existing = await storage.getPaymentNumbers().then((items) => items.find((item) => item.id === id));
      const countryCode = String(country ?? existing?.country ?? "").trim().toUpperCase();
      if (!await getActiveCountry(countryCode)) {
        return res.status(400).json({ message: "Country unavailable" });
      }
      if (operatorName !== undefined && !await isActiveCountryOperator(countryCode, operatorName)) {
        return res.status(400).json({ message: "Add this operator to the country configuration first" });
      }
      const num = await storage.updatePaymentNumber(id, {
        ownerName: ownerName === undefined ? undefined : String(ownerName).trim().slice(0, 100),
        phone: phone === undefined ? undefined : validatePhone(phone, "Number"),
        operatorName: operatorName === undefined ? undefined : String(operatorName).trim().slice(0, 60),
        country: country === undefined ? undefined : countryCode,
        logoUrl, isActive,
      });
      res.json(num);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/payment-numbers/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePaymentNumber(parseInt(getRouteParam(req, "id")));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Deposits
  app.post("/api/deposits", requireAuth, async (req, res) => {
    try {
      const { amount, accountName, accountNumber, paymentMethod, country, paymentChannelId, useSoleaspay, useWestpay, otpCode,
        paymentNumberId, channelName, screenshot, paymentMessage, reference } = req.body;
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const activeUserCountry = await getActiveCountry(user.country);
      if (!activeUserCountry) {
        return res.status(400).json({ message: "Deposits are not available for this country" });
      }
      if (!useWestpay && !useSoleaspay) {
        return res.status(400).json({ message: "Automatic deposits must use an available payment provider" });
      }

      const settings = await storage.getSettings();
       const minDeposit = parseInt(getBaseSettingForCountry(settings, "minDeposit", activeUserCountry.code, "320"));
       const localMinDeposit = fromBaseCurrency(minDeposit, activeUserCountry.code);
       const requestedAmount = typeof amount === "number" ? amount : Number(amount);
        if (!Number.isFinite(requestedAmount) || requestedAmount < localMinDeposit) {
         return res.status(400).json({ message: `Minimum amount: ${localMinDeposit.toLocaleString("en-US")} ${getCurrencyCode(activeUserCountry.code)}` });
      }

       const parsedDeposit = depositSchema.safeParse({
          amount: requestedAmount,
         accountName, accountNumber, paymentMethod, country,
         paymentChannelId: paymentChannelId === undefined ? undefined : Number(paymentChannelId),
       });
       if (!parsedDeposit.success) {
         return res.status(400).json({ message: parsedDeposit.error.errors[0]?.message || "Invalid data" });
       }
       if (screenshot !== undefined && screenshot !== null) {
         if (
           typeof screenshot !== "string" ||
           screenshot.length > 7_000_000 ||
           !/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(screenshot)
         ) {
           return res.status(400).json({ message: "Invalid or oversized screenshot (7 MB maximum)" });
         }
       }
       const normalizedDeposit = parsedDeposit.data;
       const ledgerAmount = toBaseCurrency(normalizedDeposit.amount, activeUserCountry.code);
       if (normalizedDeposit.country !== user.country || !await getActiveCountry(normalizedDeposit.country)) {
         return res.status(400).json({ message: "The deposit must be made for your account country" });
       }
       if (useSoleaspay) {
          return res.status(400).json({ message: "Soleaspay is not configured for this country. Use an available channel." });
       }
       if (!useWestpay && !useSoleaspay) {
          if (!await isActiveCountryOperator(normalizedDeposit.country, normalizedDeposit.paymentMethod)) {
            return res.status(400).json({ message: "This operator is not available in this country" });
         }
         if (!paymentNumberId) {
            return res.status(400).json({ message: "Select a payment number" });
         }
          const paymentNumbers = await storage.getPaymentNumbersByCountry(normalizedDeposit.country);
         const selectedPaymentNumber = paymentNumbers.find((item) =>
           item.id === Number(paymentNumberId) &&
           item.operatorName.trim().toLocaleLowerCase() === normalizedDeposit.paymentMethod.trim().toLocaleLowerCase(),
         );
         if (!selectedPaymentNumber) {
           return res.status(400).json({ message: "The selected payment number is unavailable" });
         }
       }

      const soleaspayEnabled = settings.soleaspayEnabled !== "false";
      const soleaspayCountries = settings.soleaspayCountries ? settings.soleaspayCountries.split(",").filter(Boolean) : [];
      const orderId = `JOLLIBEE-${Date.now()}-${user.id}`;
      
      // Only use Soleaspay when user explicitly chose the Soleaspay channel (Westpay)
      if (useSoleaspay && soleaspayEnabled) {
         if (!isSoleaspaySupported(normalizedDeposit.country, normalizedDeposit.paymentMethod)) {
          return res.status(400).json({
            message: `The operator "${normalizedDeposit.paymentMethod}" is not supported by this channel for country "${normalizedDeposit.country}". Please choose another channel.`,
            soleaspay: true,
          });
        }
        try {
          const paymentResult = await initiatePayment(
            normalizedDeposit.accountNumber,
            normalizedDeposit.amount,
            normalizedDeposit.country,
            normalizedDeposit.paymentMethod,
            orderId,
            normalizedDeposit.accountName,
            `user${user.id}@intel.com`
          );

          if (paymentResult.success && paymentResult.data) {
            const deposit = await storage.createDeposit({
              userId: req.session.userId!,
             amount: ledgerAmount,
             accountName: normalizedDeposit.accountName,
             accountNumber: normalizedDeposit.accountNumber,
             country: normalizedDeposit.country,
             paymentMethod: normalizedDeposit.paymentMethod,
               paymentChannelId: normalizedDeposit.paymentChannelId && normalizedDeposit.paymentChannelId > 0 ? normalizedDeposit.paymentChannelId : null,
              status: "processing",
              soleaspayReference: paymentResult.data.reference,
              soleaspayOrderId: orderId,
            });

            return res.json({ 
              deposit,
              soleaspay: true,
              reference: paymentResult.data.reference,
              status: paymentResult.status,
              message: paymentResult.message
            });
          } else {
            return res.status(400).json({ 
              message: paymentResult.message || "Soleaspay error",
              soleaspay: true
            });
          }
        } catch (soleaspayError: any) {
          console.error("[soleaspay] Payment error:", soleaspayError);
          return res.status(400).json({ 
            message: soleaspayError.message || "Soleaspay payment error",
            soleaspay: true
          });
        }
      }

      // ── WestPay: redirect-based hosted-payment flow ─────────────────────────
      const westpayEnabledDeposit = settings.westpayEnabled === "true";
      const westpayCountries = (settings.westpayCountries || "")
        .split(",")
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
       if (useWestpay && (!westpayEnabledDeposit || (westpayCountries.length > 0 && !westpayCountries.includes(normalizedDeposit.country)))) {
         return res.status(400).json({ message: "WestPay is not enabled for this country", westpay: true });
      }
      if (useWestpay && westpayEnabledDeposit) {
        try {
          if (!process.env.WESTPAY_MERCHANT_SLUG) {
            return res.status(400).json({ message: "WestPay is not configured: WESTPAY_MERCHANT_SLUG must be set on the server", westpay: true });
          }
          const baseUrl = getPublicAppBaseUrl(req);
          // Create deposit to get an ID, then build the redirect URL
          const deposit = await storage.createDeposit({
            userId: req.session.userId!,
             amount: ledgerAmount,
            accountName: normalizedDeposit.accountName || user.fullName,
            accountNumber: normalizedDeposit.accountNumber || user.phone,
            country: normalizedDeposit.country,
            paymentMethod: "WestPay",
            paymentChannelId: normalizedDeposit.paymentChannelId && normalizedDeposit.paymentChannelId > 0 ? normalizedDeposit.paymentChannelId : null,
            status: "pending",
          });
          const callbackUrl = `${baseUrl}/api/westpay/callback?depositId=${deposit.id}`;
          const westpayUrl = westpayBuildUrl({
             amount: normalizedDeposit.amount,
            countryCode: normalizedDeposit.country,
            redirectUrl: callbackUrl,
          });
          return res.json({ deposit, westpayUrl, westpay: true });
        } catch (westpayError: any) {
          console.error("[westpay] deposit error:", westpayError);
          return res.status(400).json({ message: westpayError.message || "WestPay error", westpay: true });
        }
      }

      const deposit = await storage.createDeposit({
        userId: req.session.userId!,
             amount: ledgerAmount,
         accountName: normalizedDeposit.accountName,
         accountNumber: normalizedDeposit.accountNumber,
         country: normalizedDeposit.country,
         paymentMethod: normalizedDeposit.paymentMethod,
         paymentChannelId: normalizedDeposit.paymentChannelId && normalizedDeposit.paymentChannelId > 0 ? normalizedDeposit.paymentChannelId : null,
        paymentNumberId: paymentNumberId || null,
        channelName: channelName || null,
        screenshot: screenshot || null,
        paymentMessage: paymentMessage || null,
        reference: reference || null,
        status: "pending",
      });

      res.json({ deposit, soleaspay: false });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Verify payment status (Soleaspay)
  app.get("/api/deposits/:id/verify", requireAuth, async (req, res) => {
    try {
      const depositId = parseInt(getRouteParam(req, "id"));
      const deposit = await storage.getDeposit(depositId);
      
      if (!deposit) {
        return res.status(404).json({ message: "Deposit not found" });
      }

      if (deposit.userId !== req.session.userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (deposit.status === "approved" || deposit.status === "rejected") {
        return res.json({ status: deposit.status });
      }

      if (deposit.soleaspayReference && deposit.soleaspayOrderId) {
        try {
          const verifyResult = await verifyPayment(deposit.soleaspayOrderId, deposit.soleaspayReference);
          const newStatus = mapSoleaspayStatus(verifyResult.status);

          if (newStatus !== "pending" && newStatus !== deposit.status) {
            if (newStatus === "approved") {
              const claimedDeposit = await storage.claimDepositApproval(depositId);
              const user = claimedDeposit ? await storage.getUser(claimedDeposit.userId) : undefined;
              if (user) {
                const credited = await storage.creditDeposit(
                  user.id,
                  claimedDeposit!.amount,
                  `Soleaspay deposit #${claimedDeposit!.id}`,
                );
                if (credited) await storage.processDepositReferralCommissions(user.id, claimedDeposit!.amount);
              }
            } else {
              await storage.updateDeposit(depositId, {
                status: newStatus,
                processedAt: new Date(),
              });
            }
          }

          return res.json({ 
            status: newStatus,
            soleaspay: true,
            soleaspayStatus: verifyResult.status,
            message: verifyResult.message
          });
        } catch (verifyError: any) {
          console.error("[soleaspay] Verify error:", verifyError);
          return res.json({ 
            status: deposit.status,
            soleaspay: true,
            error: "Verification error"
          });
        }
      }

      return res.json({ status: deposit.status });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/deposits/history", requireAuth, async (req, res) => {
    try {
      const deposits = await storage.getUserDeposits(req.session.userId!);
      res.json(deposits);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── AshtechPay Direct API ───────────────────────────────────────────────────
  app.get("/api/ashtechpay/countries", requireAuth, async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      if (settings.ashtechEnabled !== "true" || !isAshtechConfigured()) {
        return res.status(503).json({ message: "AshtechPay is not enabled or configured" });
      }
      const activeCodes = new Set((await storage.getActiveCountries()).map((country) => country.code.toUpperCase()));
      const allowlist = (settings.ashtechCountries || "").split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
      res.json((await ashtechGetCountries()).filter((country) =>
        activeCodes.has(country.code.toUpperCase()) &&
        (allowlist.length === 0 || allowlist.includes(country.code.toUpperCase())),
      ));
    } catch (error: any) {
      console.error("[ashtechpay] countries error:", error);
      res.status(502).json({ message: error.message || "Unable to load AshtechPay countries" });
    }
  });

  app.post("/api/ashtechpay/collect", requireAuth, async (req, res) => {
    try {
      const { amount, country, operator, phone, otp, depositId, reference: requestedReference } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const settings = await storage.getSettings();
      if (settings.ashtechEnabled !== "true") {
        return res.status(400).json({ message: "AshtechPay is not enabled" });
      }
      if (!country || !operator || !phone) {
        return res.status(400).json({ message: "Country, operator, and number are required" });
      }
      const activeCountry = await getActiveCountry(country);
      if (!activeCountry || activeCountry.code !== user.country || !await isActiveCountryOperator(country, operator)) {
        return res.status(400).json({ message: "Country or operator unavailable" });
      }
      const numericAmount = Number(amount);
      const minDeposit = parseInt(getBaseSettingForCountry(settings, "minDeposit", activeCountry.code, "320"));
      const localMinDeposit = fromBaseCurrency(minDeposit, activeCountry.code);
      if (!Number.isFinite(numericAmount) || numericAmount < localMinDeposit) {
        return res.status(400).json({ message: `Minimum amount: ${localMinDeposit.toLocaleString("en-US")} ${getCurrencyCode(activeCountry.code)}` });
      }
      const ledgerAmount = toBaseCurrency(numericAmount, activeCountry.code);
      const ashtechAllowlist = (settings.ashtechCountries || "").split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
      if (ashtechAllowlist.length > 0 && !ashtechAllowlist.includes(activeCountry.code)) {
        return res.status(400).json({ message: "AshtechPay is not enabled for this country" });
      }

      const existingDeposit = depositId ? await storage.getDeposit(Number(depositId)) : undefined;
      if (existingDeposit && existingDeposit.userId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const generatedReference = `paget-studio-${Date.now()}-${user.id}`;
      const requestedAshtechReference = typeof requestedReference === "string"
        ? requestedReference.trim()
        : "";
      const reference = existingDeposit?.ashtechReference?.startsWith("paget-studio-")
        ? existingDeposit.ashtechReference
        : requestedAshtechReference.startsWith("paget-studio-")
          ? requestedAshtechReference
          : generatedReference;
      const notifyBaseUrl = getPublicAppBaseUrl(req);
      const result = await ashtechCollect({
        amount: numericAmount,
        currency: activeCountry.currency,
        phone: String(phone).trim(),
        operator: String(operator).trim(),
        countryCode: String(country).trim().toUpperCase(),
        reference,
        notifyUrl: `${notifyBaseUrl}/api/webhooks/ashtechpay`,
        ...(otp ? { otp: String(otp).trim() } : {}),
      });

      const mappedStatus = mapAshtechStatus(result.status);
      const deposit = existingDeposit
        ? await storage.updateDeposit(existingDeposit.id, {
            // Keep successful responses claimable by the idempotent approval
            // gate below before crediting the wallet.
            status: mappedStatus === "approved" ? "processing" : mappedStatus,
            ashtechTransactionId: result.transaction_id || existingDeposit.ashtechTransactionId,
            ashtechReference: reference,
          })
        : await storage.createDeposit({
            userId: user.id,
            amount: ledgerAmount,
            accountName: user.fullName,
            accountNumber: String(phone).trim(),
            country: String(country).trim().toUpperCase(),
            paymentMethod: String(operator).trim(),
            status: mappedStatus === "approved" ? "processing" : mappedStatus,
            ashtechTransactionId: result.transaction_id,
            ashtechReference: reference,
          });

      if (mappedStatus === "approved") {
        const claimedDeposit = await storage.claimDepositApproval(deposit.id);
        if (claimedDeposit) await creditApprovedDeposit(claimedDeposit);
      }

      res.status(202).json({
        depositId: deposit.id,
        transactionId: result.transaction_id,
        reference,
        status: mappedStatus,
        requiresOtp: Boolean(result.ussd_code || result.message?.toLowerCase().includes("otp")),
        ussdCode: result.ussd_code || null,
        waveUrl: result.wave_url || null,
        message: result.message || null,
      });
    } catch (error: any) {
      if (error instanceof AshtechApiError && error.status === 400 && error.data?.error === "otp_required") {
        const {
          amount: requestedAmount,
          country: requestCountry,
          operator: requestOperator,
          phone: requestPhone,
          depositId: requestDepositId,
        } = req.body;
        const otpUser = await storage.getUser(req.session.userId!);
        if (!otpUser) return res.status(401).json({ message: "Not authenticated" });
        const otpAmount = Number(requestedAmount);
        const otpCountryCode = String(requestCountry || otpUser.country).trim().toUpperCase();
        const otpActiveCountry = await getActiveCountry(otpCountryCode);
        if (!otpActiveCountry || otpActiveCountry.code !== otpUser.country || !Number.isFinite(otpAmount)) {
          return res.status(400).json({ message: "Country or amount unavailable" });
        }
        const otpLedgerAmount = toBaseCurrency(otpAmount, otpActiveCountry.code);
        const otpExistingDeposit = requestDepositId
          ? await storage.getDeposit(Number(requestDepositId))
          : undefined;
        const otpReference = String(error.data.reference || "").trim();
        if (!otpReference) {
          return res.status(400).json({ message: error.message || "Missing AshtechPay OTP reference" });
        }

        const otpUssdCode = error.data.ussd_code
          || (requestCountry === "BF" && /orange/i.test(String(requestOperator)) ? `*144*4*6*${otpAmount}#` : null)
          || (requestCountry === "CI" && /orange/i.test(String(requestOperator)) ? "#144*82#" : null);
        const otpDeposit = otpExistingDeposit
          ? await storage.updateDeposit(otpExistingDeposit.id, { status: "pending", ashtechReference: otpReference })
          : await storage.createDeposit({
              userId: otpUser.id,
              amount: otpLedgerAmount,
              accountName: otpUser.fullName,
              accountNumber: String(requestPhone).trim(),
              country: otpCountryCode,
              paymentMethod: String(requestOperator).trim(),
              status: "pending",
              ashtechReference: otpReference,
            });

        return res.status(400).json({
          error: "otp_required",
          message: error.message,
          depositId: otpDeposit.id,
          reference: otpReference,
          requiresOtp: true,
          ussdCode: otpUssdCode,
        });
      }
       const message = error.message || "AshtechPay error";
      const errorUser = await storage.getUser(req.session.userId!);
      void sendTelegramMessage(
        [
          "❌ <b>Deposit error</b>",
          `User: ${formatTelegramValue(errorUser?.fullName || "Unknown")}`,
           `Amount: <b>${formatTelegramValue(`${req.body?.amount} ${getCurrencyCode(String(req.body?.country || errorUser?.country || "PH"))}`)}</b>`,
          `Country: ${formatTelegramValue(req.body?.country)}`,
          `Operator: ${formatTelegramValue(req.body?.operator)}`,
          `Exact error: <code>${formatTelegramValue(message)}</code>`,
        ].join("\n"),
      ).catch((notificationError) => console.error("[telegram] deposit error notification failed:", notificationError.message));
      console.error("[ashtechpay] collect error:", message);
      res.status(400).json({ message });
    }
  });

  app.get("/api/deposits/:id/ashtechpay-status", requireAuth, async (req, res) => {
    try {
      const deposit = await storage.getDeposit(parseInt(getRouteParam(req, "id")));
      if (!deposit) return res.status(404).json({ message: "Deposit not found" });
      if (deposit.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
      if (deposit.status === "approved" || deposit.status === "rejected") {
        return res.json({ status: deposit.status });
      }
      if (!deposit.ashtechTransactionId) return res.json({ status: deposit.status });

      const result = await ashtechGetTransaction(deposit.ashtechTransactionId);
      const newStatus = mapAshtechStatus(result.status);
      if (newStatus !== "pending" && newStatus !== deposit.status) {
        if (newStatus === "approved") {
          // The conditional update is the idempotency gate: only the request
          // that claims the pending deposit is allowed to credit the wallet.
          const claimedDeposit = await storage.claimDepositApproval(deposit.id);
          if (claimedDeposit) {
            const user = await storage.getUser(deposit.userId);
            if (user) {
              const credited = await storage.creditDeposit(
                user.id,
                deposit.amount,
                `AshtechPay deposit #${deposit.id}`,
              );
              if (credited) await storage.processDepositReferralCommissions(user.id, deposit.amount);
            }
          }
        } else {
          await storage.updateDeposit(deposit.id, { status: newStatus, processedAt: new Date() });
        }
      }
      const finalDeposit = await storage.getDeposit(deposit.id);
      res.json({ status: finalDeposit?.status || newStatus, rawStatus: result.status });
    } catch (error: any) {
      console.error("[ashtechpay] status error:", error);
      res.status(502).json({ message: error.message || "AshtechPay verification error" });
    }
  });

  // ── SendavaPay routes ──────────────────────────────────────────────────────

  // Proxy: operators for a given country (public SendavaPay endpoint)
  app.get("/api/sendavapay/operators/:country", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      if (settings.sendavapayEnabled !== "true") {
        return res.status(503).json({ success: false, message: "SendavaPay is not enabled" });
      }
      const requestedCountry = getRouteParam(req, "country").toUpperCase();
      if (!await getActiveCountry(requestedCountry)) {
        return res.status(404).json({ success: false, message: "Country unavailable" });
      }
      const svCountry = toSendavapayCountry(requestedCountry);
      const r = await fetch(
        `https://sendavapay.com/api/sdk/v1/operators/${svCountry}`
      );
      const data = await r.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create payment (server-side, stores deposit record)
  app.post("/api/sendavapay/create", requireAuth, async (req, res) => {
    try {
      const { amount, country, operatorId, operatorName, payerPhone } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const settings = await storage.getSettings();
      if (settings.sendavapayEnabled !== "true") {
        return res.status(400).json({ message: "SendavaPay is not enabled" });
      }
       const minDeposit = parseInt(getBaseSettingForCountry(settings, "minDeposit", user.country, "320"));
       const localMinDeposit = fromBaseCurrency(minDeposit, user.country);
       const requestedAmount = Number(amount);
       if (!Number.isFinite(requestedAmount) || requestedAmount < localMinDeposit) {
         return res.status(400).json({ message: `Minimum amount: ${localMinDeposit.toLocaleString("en-US")} ${getCurrencyCode(user.country)}` });
      }
      if (!payerPhone || !payerPhone.trim()) {
        return res.status(400).json({ message: "Mobile Money number is required" });
      }
      const activeCountry = await getActiveCountry(country);
      if (!activeCountry || activeCountry.code !== user.country || !await isActiveCountryOperator(country, operatorName)) {
        return res.status(400).json({ message: "Country or operator unavailable" });
      }

      const svCountry = toSendavapayCountry(country);
      const currency = sendavapayGetCurrency(country);
      const externalRef = `DEP-${Date.now()}-${user.id}`;
      // Only use the number explicitly entered for this deposit; never reuse the profile phone.
      const customerPhone = sendavapayFormatPhone(payerPhone.trim(), country);
      const baseUrl = getPublicAppBaseUrl(req);
      const webhookUrl = `${baseUrl}/api/webhooks/sendavapay`;

      const result = await sendavapayCreate({
         amount: requestedAmount,
        currency,
        description: `Deposit #${externalRef}`,
        customerName: user.fullName,
        customerPhone,
        customerEmail: `user${user.id}@sybotx.app`,
        payerCountry: svCountry,
        webhookUrl,
        externalReference: externalRef,
      });

      if (!result.success || !result.data) {
        return res.status(400).json({
          message: result.error || "SendavaPay error",
        });
      }

      const deposit = await storage.createDeposit({
        userId: user.id,
         amount: toBaseCurrency(requestedAmount, activeCountry.code),
        accountName: user.fullName,
        accountNumber: customerPhone,
        country,
        paymentMethod: operatorName || "SendavaPay",
        status: "processing",
        sendavapayReference: result.data.reference,
        sendavapayToken: result.data.paymentToken,
      });

      res.json({
        depositId: deposit.id,
        paymentToken: result.data.paymentToken,
        reference: result.data.reference,
        expiresAt: result.data.expiresAt,
      });
    } catch (error: any) {
      console.error("[sendavapay] create error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  // Initiate payment (proxy, calls CORS endpoint on behalf of authenticated user)
  app.post("/api/sendavapay/initiate", requireAuth, async (req, res) => {
    try {
      const { paymentToken, payerCountry, operatorId, depositId, payerPhone } = req.body;
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (!payerPhone || !payerPhone.trim()) {
        return res.status(400).json({ message: "Mobile Money number is required" });
      }
      const deposit = depositId ? await storage.getDeposit(Number(depositId)) : undefined;
      if (!deposit || deposit.userId !== user.id || !await getActiveCountry(payerCountry) || deposit.country !== String(payerCountry).toUpperCase()) {
        return res.status(400).json({ message: "Payment or country unavailable" });
      }

      const svCountry = toSendavapayCountry(payerCountry);
      const customerPhone = sendavapayFormatPhone(payerPhone.trim(), payerCountry);

      const result = await sendavapayInitiate({
        paymentToken,
        payerName: user.fullName,
        payerPhone: customerPhone,
        payerCountry: svCountry,
        operatorId,
      });

      // Update deposit status to processing
      if (depositId) {
        await storage.updateDeposit(depositId, { status: "processing" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("[sendavapay] initiate error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  // Submit OTP — CLIENT (CORS) endpoint, no SDK key
  app.post("/api/sendavapay/submit-otp", requireAuth, async (req, res) => {
    try {
      const { otpToken, otp } = req.body;
      if (!otpToken || !otp) {
        return res.status(400).json({ message: "otpToken and otp are required" });
      }
      const result = await sendavapaySubmitOtp({ otpToken, otp });
      res.json(result);
    } catch (error: any) {
      console.error("[sendavapay] submit-otp error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  // Retry a failed payment — CLIENT (CORS) endpoint, no SDK key
  app.post("/api/sendavapay/retry", requireAuth, async (req, res) => {
    try {
      const { paymentToken, depositId } = req.body;
      if (!paymentToken) {
        return res.status(400).json({ message: "paymentToken is required" });
      }
      const deposit = depositId ? await storage.getDeposit(Number(depositId)) : undefined;
      if (!deposit || deposit.userId !== req.session.userId || deposit.sendavapayToken !== paymentToken) {
        return res.status(403).json({ message: "Payment unavailable" });
      }
      // Reset deposit status to processing
      if (depositId) {
        await storage.updateDeposit(depositId, { status: "processing" });
      }
      const result = await sendavapayRetry(paymentToken);
      res.json(result);
    } catch (error: any) {
      console.error("[sendavapay] retry error:", error);
      res.status(500).json({ message: error.message || "Server error" });
    }
  });

  // Poll payment status using GET /payment-status/:reference (lighter than verify-payment)
  app.get("/api/deposits/:id/sendavapay-status", requireAuth, async (req, res) => {
    try {
      const depositId = parseInt(getRouteParam(req, "id"));
      const deposit = await storage.getDeposit(depositId);
      if (!deposit) return res.status(404).json({ message: "Deposit not found" });
      if (deposit.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });

      if (deposit.status === "approved" || deposit.status === "rejected") {
        return res.json({ status: deposit.status });
      }

      if (!deposit.sendavapayReference) {
        return res.json({ status: deposit.status });
      }

      // Use lightweight GET payment-status endpoint for polling
      const statusRes = await fetch(
        `${process.env.SENDAVAPAY_API_BASE || "https://sendavapay.com/api/sdk/v1"}/payment-status/${deposit.sendavapayReference}`,
        { headers: { Authorization: `Bearer ${process.env.SENDAVAPAY_API_KEY || ""}` } }
      );
      const statusData = await statusRes.json() as { success: boolean; data?: { status: string } };

      if (!statusData.success || !statusData.data) {
        return res.json({ status: deposit.status });
      }

      const newStatus = mapSendavapayStatus(statusData.data.status);
      if (newStatus !== "pending" && newStatus !== deposit.status) {
        if (newStatus === "approved") {
          const claimedDeposit = await storage.claimDepositApproval(depositId);
          if (claimedDeposit) await creditApprovedDeposit(claimedDeposit);
        } else {
          await storage.updateDeposit(depositId, { status: newStatus, processedAt: new Date() });
        }
      }

      res.json({ status: newStatus || deposit.status, rawStatus: statusData.data.status });
    } catch (error: any) {
      console.error("[sendavapay] status check error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Webhook (HMAC verified)
  // AshtechPay does not document a webhook signature. This endpoint therefore
  // never trusts the posted event/status: it only uses it to locate the
  // deposit, then verifies the transaction through the authenticated API.
  app.post("/api/webhooks/ashtechpay", async (req, res) => {
    try {
      if (!isAshtechConfigured()) {
        return res.status(503).json({ message: "AshtechPay is not configured" });
      }
      const payload = req.body || {};
      const reference = String(payload.reference || payload.data?.reference || "").trim();
      const transactionId = String(
        payload.transaction_id || payload.transactionId || payload.data?.transaction_id || payload.data?.transactionId || "",
      ).trim();
      let deposit = transactionId
        ? await storage.getDepositByAshtechTransactionId(transactionId)
        : undefined;
      if (!deposit && reference) {
        deposit = await storage.getDepositByAshtechReference(reference);
      }
      if (!deposit) return res.status(202).json({ received: true });
      if (deposit.status === "approved" || deposit.status === "rejected") {
        return res.json({ received: true, status: deposit.status });
      }
      if (!deposit.ashtechTransactionId) return res.status(202).json({ received: true });

      const verified = await ashtechGetTransaction(deposit.ashtechTransactionId);
      const verifiedStatus = mapAshtechStatus(verified.status);
      if (verifiedStatus === "approved") {
        const claimedDeposit = await storage.claimDepositApproval(deposit.id);
        if (claimedDeposit) await creditApprovedDeposit(claimedDeposit);
      } else if (verifiedStatus === "rejected") {
        await storage.updateDeposit(deposit.id, { status: "rejected", processedAt: new Date() });
      }
      res.json({ received: true, status: verifiedStatus });
    } catch (error: any) {
      console.error("[ashtechpay webhook] verification error:", error);
      res.status(502).json({ message: "AshtechPay verification unavailable" });
    }
  });

  app.post(
    "/api/webhooks/sendavapay",
    async (req, res) => {
      try {
        const settings = await storage.getSettings();
        // Prefer the deployment secret; keep the admin setting as a
        // backwards-compatible fallback for existing installations.
        const secret = process.env.SENDAVAPAY_WEBHOOK_SECRET || settings.sendavapayWebhookSecret || "";
        if (!secret) {
          console.error("[sendavapay webhook] Webhook secret not configured");
          return res.status(503).json({ message: "Webhook secret is not configured" });
        }
        const sig = req.headers["x-sendavapay-signature"] as string || "";
        // req.rawBody is captured by the global express.json verify callback
        const rawBuf = (req as any).rawBody as Buffer | undefined;
        if (secret && rawBuf && !sendavapayVerifySignature(rawBuf, sig, secret)) {
          console.warn("[sendavapay webhook] Invalid signature");
          return res.status(401).json({ message: "Invalid signature" });
        }

        const payload = req.body;
        const { event, reference, status } = payload;

        if (!reference) return res.json({ received: true });

        // Find deposit by sendavapay reference
        const deposit = await storage.getDepositBySendavapayReference(reference);
        if (!deposit) {
          console.warn(`[sendavapay webhook] No deposit found for reference ${reference}`);
          return res.json({ received: true });
        }

        if (deposit.status === "approved" || deposit.status === "rejected") {
          return res.json({ received: true }); // already processed
        }

        if (event === "payment.completed" || status === "completed") {
          const claimedDeposit = await storage.claimDepositApproval(deposit.id);
          if (claimedDeposit) await creditApprovedDeposit(claimedDeposit);
        } else if (event === "payment.failed" || event === "payment.expired" || status === "failed" || status === "cancelled") {
          await storage.updateDeposit(deposit.id, { status: "rejected", processedAt: new Date() });
        }

        res.json({ received: true });
      } catch (error: any) {
        console.error("[sendavapay webhook] error:", error);
        res.status(500).json({ message: error.message });
      }
    }
  );

  // ── WestPay: payment callback (redirect after user pays on WestPay page) ────
  app.get("/api/westpay/callback", requireAuth, async (req, res) => {
    try {
      const { depositId, status, ref } = req.query as Record<string, string>;
      const baseUrl = getPublicAppBaseUrl(req);
      if (!depositId) return res.redirect(`${baseUrl}/deposit?wp_status=error`);
      const deposit = await storage.getDeposit(parseInt(depositId));
      if (!deposit) return res.redirect(`${baseUrl}/deposit?wp_status=error`);
      if (deposit.userId !== req.session.userId) {
        return res.redirect(`${baseUrl}/deposit?wp_status=error`);
      }
      // Persist the WestPay transaction reference; webhook will approve
      if (ref && !deposit.westpayReference && (deposit.status === "pending" || deposit.status === "processing")) {
        await storage.updateDeposit(deposit.id, { westpayReference: ref });
      }
      const wpStatus = status === "success" ? "success" : "pending";
      res.redirect(`${baseUrl}/deposit?wp_status=${wpStatus}&wp_depositId=${depositId}`);
    } catch (err: any) {
      console.error("[westpay callback] error:", err);
      const baseUrl = getPublicAppBaseUrl(req);
      res.redirect(`${baseUrl}/deposit?wp_status=error`);
    }
  });

  // ── WestPay webhook (HMAC-SHA256 via X-RobotPay-Signature) ──────────────────
  app.post(
    "/api/webhooks/westpay",
    async (req, res) => {
      try {
        const settings = await storage.getSettings();
        const secret = process.env.WESTPAY_WEBHOOK_SECRET || settings.westpayWebhookSecret || "";
        if (!secret) {
          console.error("[westpay webhook] Webhook secret not configured");
          return res.status(503).json({ message: "Webhook secret is not configured" });
        }
        const sig = (req.headers["x-robotpay-signature"] as string) || "";
        // req.rawBody is captured by the global express.json verify callback.
        // Never process a webhook when the raw payload was not captured:
        // parsing alone is not sufficient to authenticate the notification.
        const rawBuf = (req as any).rawBody as Buffer | undefined;
        if (!rawBuf || !westpayVerifySignature(rawBuf, sig, secret)) {
          console.warn("[westpay webhook] Invalid signature");
          return res.status(401).json({ message: "Invalid signature" });
        }
        const payload = req.body;
        const { event, txId, status } = payload;
        if (!txId) return res.json({ received: true });
        const deposit = await storage.getDepositByWestpayReference(txId);
        if (!deposit) {
          console.warn(`[westpay webhook] No deposit found for txId: ${txId}`);
          return res.json({ received: true });
        }
        if (deposit.status === "approved" || deposit.status === "rejected") {
          return res.json({ received: true });
        }
        if (event === "payment.confirmed" || status === "confirmed") {
          const claimedDeposit = await storage.claimDepositApproval(deposit.id);
          if (claimedDeposit) await creditApprovedDeposit(claimedDeposit);
        } else if (
          event === "payment.failed" ||
          event === "payment.expired" ||
          status === "failed" ||
          status === "expired" ||
          status === "cancelled"
        ) {
          await storage.updateDeposit(deposit.id, { status: "rejected", processedAt: new Date() });
        }
        res.json({ received: true });
      } catch (err: any) {
        console.error("[westpay webhook] error:", err);
        res.status(500).json({ message: err.message });
      }
    }
  );

  // Withdrawals
  app.post("/api/withdrawals", requireAuth, async (req, res) => {
    try {
      const { amount, walletId } = req.body;
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

       const requestedLocalAmount = Number(amount);
       const requestedAmount = toBaseCurrency(requestedLocalAmount, user.country);
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      const settingsForWithdrawal = await storage.getSettings();
       const withdrawalStartHour = parseInt(settingsForWithdrawal.withdrawalStartHour || "9", 10);
       const withdrawalEndHour = parseInt(settingsForWithdrawal.withdrawalEndHour || "17", 10);
       if (!isWithinWithdrawalHours(user.country, withdrawalStartHour, withdrawalEndHour)) {
         return res.status(400).json({
           message: `Withdrawals are available from ${withdrawalStartHour}:00 to ${withdrawalEndHour}:00 in your country`,
         });
       }
       const minWithdrawal = parseInt(getBaseSettingForCountry(settingsForWithdrawal, "minWithdrawal", user.country, "100"));
       const localMinWithdrawal = fromBaseCurrency(minWithdrawal, user.country);
       if (requestedLocalAmount < localMinWithdrawal) {
          return res.status(400).json({ message: `Minimum amount: ${localMinWithdrawal.toLocaleString("en-US")} ${getCurrencyCode(user.country)}` });
      }

      if (!user.hasActiveProduct) {
        return res.status(400).json({ message: "Buy a product first" });
      }

      if (user.isWithdrawalBlocked) {
        return res.status(400).json({ message: "Withdrawals are blocked on this account" });
      }

      if (user.mustInviteToWithdraw) {
        const stats = await storage.getTeamStats(user.id);
        if (stats.level1Invested < 1) {
          return res.status(400).json({ message: "Invite someone who invests" });
        }
      }

      const balance = parseFloat(user.balance);
      if (requestedAmount > balance) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const selectedWalletId = Number(walletId);
      const wallet = Number.isInteger(selectedWalletId)
        ? (await storage.getWallets(user.id)).find((item) => item.id === selectedWalletId)
        : undefined;
      if (!wallet) {
        return res.status(400).json({ message: "Select a valid withdrawal wallet" });
      }
      if (wallet.country !== user.country || !await isActiveCountryOperator(wallet.country, wallet.paymentMethod)) {
        return res.status(400).json({ message: "Select a wallet with an active operator in your country" });
      }

      const todayCount = await storage.getUserWithdrawalCountToday(user.id);
      const settingsForMax = await storage.getSettings();
      const maxPerDay = parseInt(settingsForMax.maxWithdrawalsPerDay || "1");
      if (todayCount >= maxPerDay) {
        return res.status(400).json({ message: `Maximum ${maxPerDay} withdrawal${maxPerDay > 1 ? 's' : ''} per day` });
      }

      const settings = await storage.getSettings();
       const fees = parseFloat(settings.withdrawalFees || "10");
      const feeAmount = Math.round(requestedAmount * fees / 100);
      const netAmount = requestedAmount - feeAmount;

      const withdrawal = await storage.createWithdrawalWithDebit(user.id, requestedAmount, {
        userId: user.id,
        amount: requestedAmount,
        netAmount,
        fees: feeAmount,
        accountName: wallet.accountName,
        accountNumber: wallet.accountNumber,
        country: wallet.country,
        paymentMethod: wallet.paymentMethod,
        status: "pending",
      });
      if (!withdrawal) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      void sendTelegramMessage(
        [
          "💸 <b>Withdrawal initiated</b>",
          `User: ${formatTelegramValue(user.fullName)}`,
           `Amount: <b>${formatTelegramValue(amountForCountry(requestedAmount, user.country))}</b>`,
           `Net after fees: ${formatTelegramValue(amountForCountry(netAmount, user.country))}`,
          `Method: ${formatTelegramValue(wallet.paymentMethod)}`,
          `Country: ${formatTelegramValue(wallet.country)}`,
          `Withdrawal ID: ${formatTelegramValue(withdrawal.id)}`,
        ].join("\n"),
      ).catch((error) => console.error("[telegram] withdrawal notification failed:", error.message));

      res.json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/withdrawals/history", requireAuth, async (req, res) => {
    try {
      const withdrawals = await storage.getUserWithdrawals(req.session.userId!);
      res.json(withdrawals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Wallets
  app.get("/api/wallets", requireAuth, async (req, res) => {
    try {
      const wallets = await storage.getWallets(req.session.userId!);
      res.json(wallets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/wallets", requireAuth, async (req, res) => {
    try {
      const parsedWallet = walletSchema.safeParse(req.body);
      if (!parsedWallet.success) {
        return res.status(400).json({ message: parsedWallet.error.errors[0]?.message || "Invalid data" });
      }
      const user = await storage.getUser(req.session.userId!);
      if (!user || parsedWallet.data.country !== user.country || !await getActiveCountry(user.country)) {
        return res.status(400).json({ message: "The wallet must match your account's active country" });
      }
      if (!await isActiveCountryOperator(user.country, parsedWallet.data.paymentMethod)) {
        return res.status(400).json({ message: "Select an operator available in your country" });
      }
      const wallet = await storage.createWallet({
        userId: req.session.userId!,
        ...parsedWallet.data,
      });
      res.json(wallet);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/wallets/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteWallet(req.session.userId!, parseInt(getRouteParam(req, "id")));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/wallets/:id/default", requireAuth, async (req, res) => {
    try {
      await storage.setDefaultWallet(req.session.userId!, parseInt(getRouteParam(req, "id")));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Team
  app.get("/api/team/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getTeamStats(req.session.userId!);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/team/details", requireAuth, async (req, res) => {
    try {
      const team = await storage.getDetailedTeam(req.session.userId!);
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Tasks
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getTasksWithStatus(req.session.userId!);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/tasks/:id/claim", requireAuth, async (req, res) => {
    try {
      await storage.claimTask(req.session.userId!, parseInt(getRouteParam(req, "id")));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

   // Daily bonus claim (10 PHP every 24h)
  app.post("/api/claim-daily-bonus", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const now = new Date();
      const lastClaim = user.lastDailyBonusClaim ? new Date(user.lastDailyBonusClaim) : null;
      
      if (lastClaim) {
        const hoursSinceClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
        if (hoursSinceClaim < 24) {
          const hoursRemaining = Math.ceil(24 - hoursSinceClaim);
          return res.status(400).json({ 
            message: `You can claim in ${hoursRemaining}h`,
            canClaim: false,
            nextClaimIn: hoursRemaining
          });
        }
      }

      const claimed = await storage.claimDailyBonus(user.id, 10);
      if (!claimed) {
        return res.status(400).json({
          message: "The daily bonus was already claimed",
          canClaim: false,
        });
      }

        res.json({
          success: true,
          message: `${fromBaseCurrency(10, user.country).toLocaleString("en-US")} ${getCurrencyCode(user.country)} bonus added!`,
        });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/daily-bonus-status", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const now = new Date();
      const lastClaim = user.lastDailyBonusClaim ? new Date(user.lastDailyBonusClaim) : null;
      
      let canClaim = true;
      let hoursRemaining = 0;

      if (lastClaim) {
        const hoursSinceClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
        if (hoursSinceClaim < 24) {
          canClaim = false;
          hoursRemaining = Math.ceil(24 - hoursSinceClaim);
        }
      }

      const allTransactions = await storage.getUserTransactions(req.session.userId!);
      const bonusTransactions = allTransactions.filter(
        (t: any) => t.type === "bonus" && t.description === "Daily bonus"
      );
      const totalBonusClaimed = bonusTransactions.reduce(
        (sum: number, t: any) => sum + parseFloat(t.amount || "0"), 0
      );
      const daysPointed = bonusTransactions.length;

      res.json({ canClaim, hoursRemaining, totalBonusClaimed, daysPointed });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Transactions
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const transactions = await storage.getUserTransactions(req.session.userId!);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(publicSettings(settings));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/settings/links", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json({
        supportLink: settings.supportLink || "https://t.me/intelappgroup",
        support2Link: settings.support2Link || "https://t.me/intelappgroup",
        channelLink: settings.channelLink || "https://t.me/intelappgroup",
        groupLink: settings.groupLink || "https://t.me/intelappgroup",
        supportType: settings.supportType || "telegram",
        support2Type: settings.support2Type || "telegram",
        channelType: settings.channelType || "telegram",
        groupType: settings.groupType || "telegram",
        supportLabel: settings.supportLabel || "Customer service",
        support2Label: settings.support2Label || "Customer service 2",
        channelLabel: settings.channelLabel || "Official channel",
        groupLabel: settings.groupLabel || "Discussion group",
        withdrawalStartHour: settings.withdrawalStartHour || "9",
        withdrawalEndHour: settings.withdrawalEndHour || "17",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/settings/withdrawal", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const user = await storage.getUser(req.session.userId!);
      const countryCode = user?.country || "PH";
      res.json({
        withdrawalFees: parseFloat(settings.withdrawalFees || "10"),
        withdrawalStartHour: parseInt(settings.withdrawalStartHour || "9"),
        withdrawalEndHour: parseInt(settings.withdrawalEndHour || "17"),
        maxWithdrawalsPerDay: parseInt(settings.maxWithdrawalsPerDay || "1"),
        minWithdrawal: fromBaseCurrency(
          parseInt(getBaseSettingForCountry(settings, "minWithdrawal", countryCode, "100")),
          countryCode,
        ),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const stats = await storage.getStats(startDate, endDate);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/deposits", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string || "pending";
      const deposits = await storage.getDeposits(status === "pending" ? "pending" : undefined);
      const filtered = status === "all" ? deposits : deposits.filter(d => d.status === status);
      res.json(filtered.map((deposit) => ({
        ...deposit,
        user: deposit.user ? publicUser(deposit.user) : undefined,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/deposits/:id/seapay-request", requireAdmin, async (req, res) => {
    try {
      const deposit = await storage.getDeposit(parseInt(getRouteParam(req, "id")));
      if (!deposit?.seapayReference) {
        return res.status(404).json({ message: "SeaPay request not found" });
      }

      let payload: Record<string, unknown> = {};
      if (deposit.seapayRequestPayload) {
        try {
          const parsed = JSON.parse(deposit.seapayRequestPayload);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
        } catch {
          console.warn(`[seapay] Invalid stored request payload for deposit ${deposit.id}`);
        }
      }
      if (Object.keys(payload).length === 0) {
        const notifyUrl = getSeapayNotifyUrl(deposit.country, "deposit");
        payload = buildSeapayPayinPayload({
          merchantOrderNo: deposit.seapayReference,
          amount: fromBaseCurrency(deposit.amount, deposit.country),
          currency: getCurrencyCode(deposit.country),
          payType: getSeapayPayType(deposit.country, deposit.paymentMethod),
          notifyUrl,
          country: deposit.country,
        });
      }

      const apiKey = getSeapayApiKey(deposit.country);
      if (!apiKey) return res.status(503).json({ message: "SeaPay API key is not configured" });
      const request = { ...payload, sign: buildSeapaySignature(payload, apiKey) };
      res.json({ request, text: JSON.stringify(request, null, 2) });
    } catch (error: any) {
      console.error("[seapay] request copy error:", error);
      res.status(500).json({ message: error.message || "Unable to prepare SeaPay request" });
    }
  });

  app.get("/api/admin/deposits/soleaspay-stats", requireAdmin, async (req, res) => {
    try {
      const allDeposits = await storage.getDeposits();
      const soleaspayDeposits = allDeposits.filter((d: any) => d.soleaspayReference || d.soleaspayOrderId);

      const approvedSoleaspay = soleaspayDeposits.filter((d: any) => d.status === "approved");
      const totalAll = approvedSoleaspay.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const countAll = approvedSoleaspay.length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const approvedToday = approvedSoleaspay.filter((d: any) => new Date(d.createdAt) >= today);
      const totalToday = approvedToday.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const countToday = approvedToday.length;

      const pendingSoleaspay = soleaspayDeposits.filter((d: any) => d.status === "pending" || d.status === "processing");
      const totalPending = pendingSoleaspay.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
      const countPending = pendingSoleaspay.length;

      res.json({
        totalAll,
        countAll,
        totalToday,
        countToday,
        totalPending,
        countPending,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/deposits/:id/approve", requireAdmin, async (req, res) => {
    try {
      const deposit = await storage.claimAdminDepositApproval(parseInt(getRouteParam(req, "id")), req.session.userId!);
      if (!deposit) return res.status(409).json({ message: "This deposit has already been approved" });

      const user = await storage.getUser(deposit.userId);
      if (user) {
        await storage.creditDeposit(user.id, deposit.amount, "Deposit approved");
        await storage.processDepositReferralCommissions(deposit.userId, deposit.amount);
      }

       await storage.logAdminAction(req.session.userId!, "approve_deposit", deposit.userId, `Deposit ${deposit.id} approved: ${amountForCountry(deposit.amount, deposit.country)}`);
      res.json(deposit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/deposits/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { ban } = req.body;
      const deposit = await storage.updateDeposit(parseInt(getRouteParam(req, "id")), {
        status: "rejected",
        processedAt: new Date(),
        processedBy: req.session.userId,
        screenshot: null,
      });

      if (ban) {
        await storage.updateUser(deposit.userId, { isBanned: true });
        await storage.logAdminAction(req.session.userId!, "ban_user", deposit.userId, `User banned for fraud`);
      }

      await storage.logAdminAction(req.session.userId!, "reject_deposit", deposit.userId, `Deposit ${deposit.id} rejected`);
      res.json(deposit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/verify-pin", requireAuth, async (req, res) => {
    try {
       if (checkPinRateLimit(req, res)) return;
       const { pin } = req.body;
       if (typeof pin !== "string" || !/^\d{4,12}$/.test(pin)) {
         return res.status(400).json({ message: "Invalid PIN" });
       }
      const user = await storage.getUser(req.session.userId!);
      
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // If password is not required for this admin, auto-verify
      if (user.isAdminPasswordRequired === false) {
        return res.json({ success: true });
      }

      if (!user.adminPin) {
        return res.status(400).json({ message: "PIN is not configured" });
      }
      
       const isHashedPin = /^\$2[aby]\$\d{2}\$/.test(user.adminPin);
       const pinMatches = isHashedPin
         ? await bcrypt.compare(pin, user.adminPin)
         : safePinEqual(user.adminPin, pin);
       if (!pinMatches) {
         recordPinFailure(req);
        return res.status(401).json({ message: "Code PIN incorrect" });
      }
       clearPinFailures(req);
       if (!isHashedPin) {
         await storage.updateUser(user.id, { adminPin: await bcrypt.hash(pin, 12) });
       }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/withdrawals", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string || "pending";
      const withdrawals = await storage.getWithdrawals(status === "pending" ? "pending" : undefined);
      const filtered = status === "all" ? withdrawals : withdrawals.filter(w => w.status === status);
      res.json(filtered.map((withdrawal) => ({
        ...withdrawal,
        user: withdrawal.user ? publicUser(withdrawal.user) : undefined,
        seapayPayoutAvailable: isSeapayPayoutEnabled(withdrawal.country),
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/banker/withdrawals/:id/seapay-request", requireBanker, async (req, res) => {
    try {
      const withdrawal = (await storage.getWithdrawals()).find(
        (item) => item.id === parseInt(getRouteParam(req, "id")),
      );
      if (!withdrawal?.seapayPayoutReference) {
        return res.status(404).json({ message: "SeaPay payout request not found" });
      }

      let payload: Record<string, unknown> = {};
      if (withdrawal.seapayPayoutRequestPayload) {
        try {
          const parsed = JSON.parse(withdrawal.seapayPayoutRequestPayload);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
        } catch {
          console.warn(`[seapay] Invalid stored payout payload for withdrawal ${withdrawal.id}`);
        }
      }
      const apiSecret = getSeapayApiSecret(withdrawal.country);
      if (!apiSecret) return res.status(503).json({ message: "SeaPay payout secret is not configured" });
      const request = { ...payload, sign: buildSeapaySignature(payload, apiSecret) };
      res.json({ request, text: JSON.stringify(request, null, 2) });
    } catch (error: any) {
      console.error("[seapay] payout request copy error:", error);
      res.status(500).json({ message: error.message || "Unable to prepare SeaPay payout request" });
    }
  });

  app.post("/api/banker/withdrawals/:id/seapay", requireBanker, async (req, res) => {
    try {
      const withdrawalId = parseInt(getRouteParam(req, "id"));
      const withdrawal = await sendWithdrawalToSeapay(withdrawalId, req.session.userId!);
      await storage.logAdminAction(
        req.session.userId!,
        "send_withdrawal_seapay",
        withdrawal?.userId || 0,
        `Withdrawal ${withdrawalId} sent to SeaPay`,
      );
      res.json(withdrawal);
    } catch (error: any) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
      console.error("[seapay] payout request error:", error);
      res.status(statusCode).json({ message: error.message || "SeaPay payout unavailable" });
    }
  });

  app.post("/api/admin/withdrawals/:id/approve", requireAdmin, async (req, res) => {
    try {
      const withdrawalId = parseInt(getRouteParam(req, "id"));
      const existingWithdrawal = await storage.getWithdrawals();
      const withdrawalData = existingWithdrawal.find(w => w.id === withdrawalId);
      
      if (!withdrawalData) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      const withdrawal = await storage.claimWithdrawalApproval(withdrawalId, {
        status: "approved",
        processedAt: new Date(),
        processedBy: req.session.userId,
      });
      if (!withdrawal) return res.status(409).json({ message: "This withdrawal is already processed" });

       await storage.logAdminAction(req.session.userId!, "approve_withdrawal", withdrawalData.userId, `Withdrawal ${withdrawal.id} approved: ${amountForCountry(withdrawalData.netAmount, withdrawalData.country)}`);
      res.json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/withdrawals/:id/reject", requireAdmin, async (req, res) => {
    try {
      const withdrawal = await storage.claimWithdrawalRejection(parseInt(getRouteParam(req, "id")), {
        status: "rejected",
        processedAt: new Date(),
        processedBy: req.session.userId,
      });
      if (!withdrawal) return res.status(409).json({ message: "This withdrawal is already processed" });

      // Refund the user
      await refundWithdrawal(withdrawal);

      await storage.logAdminAction(req.session.userId!, "reject_withdrawal", withdrawal.userId, `Withdrawal ${withdrawal.id} rejected and refunded`);
      res.json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const search = (req.query.search as string) || "";
      const requestedPage = parseInt(req.query.page as string, 10);
      const requestedLimit = parseInt(req.query.limit as string, 10);
      const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
      const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
      const offset = (page - 1) * limit;
      
      const { users: allUsers, total } = await storage.getAllUsers(search, limit, offset);
      const usersWithTeam = await Promise.all(allUsers.map(async (user) => {
        const teamStats = await storage.getTeamStatsSimple(user.id);
        return { ...publicUser(user), ...teamStats, referrerName: null };
      }));
      res.json({ users: usersWithTeam, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users/:id/team", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(getRouteParam(req, "id"));
      const team = await storage.getDetailedTeam(userId);
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:id/:action", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(getRouteParam(req, "id"));
      const action = getRouteParam(req, "action");
      const { value } = req.body;
      const adminUser = await storage.getUser(req.session.userId!);

      switch (action) {
        case "balance":
          const balanceUser = await storage.getUser(userId);
          const baseBalance = Number(value);
          await storage.updateUser(userId, { balance: baseBalance.toFixed(2) });
          await storage.logAdminAction(req.session.userId!, "update_balance", userId, `Balance updated: ${amountForCountry(baseBalance, balanceUser?.country || "PH")}`);
          break;
        case "password":
          if (typeof value !== "string" || value.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
          }
          await storage.updateUser(userId, { password: value });
          await storage.logAdminAction(req.session.userId!, "reset_password", userId, `Password reset`);
          break;
        case "toggle-ban":
          const user1 = await storage.getUser(userId);
          await storage.updateUser(userId, { isBanned: !user1?.isBanned });
          await storage.logAdminAction(req.session.userId!, "toggle_ban", userId, `Banned status: ${!user1?.isBanned}`);
          break;
        case "toggle-withdrawal":
          const user2 = await storage.getUser(userId);
          await storage.updateUser(userId, { isWithdrawalBlocked: !user2?.isWithdrawalBlocked });
          await storage.logAdminAction(req.session.userId!, "toggle_withdrawal", userId, `Withdrawal blocked: ${!user2?.isWithdrawalBlocked}`);
          break;
        case "toggle-promoter":
          const user3 = await storage.getUser(userId);
          await storage.updateUser(userId, { isPromoter: !user3?.isPromoter, promoterSetBy: req.session.userId });
          await storage.logAdminAction(req.session.userId!, "toggle_promoter", userId, `Promoter: ${!user3?.isPromoter}`);
          break;
        case "toggle-must-invite":
          const user4 = await storage.getUser(userId);
          await storage.updateUser(userId, { mustInviteToWithdraw: !user4?.mustInviteToWithdraw });
          await storage.logAdminAction(req.session.userId!, "toggle_must_invite", userId, `Must invite: ${!user4?.mustInviteToWithdraw}`);
          break;
        case "toggle-admin":
          if (!adminUser?.isSuperAdmin) {
            return res.status(403).json({ message: "Action restricted to the super admin" });
          }
          const user5 = await storage.getUser(userId);
          const newAdminStatus = !user5?.isAdmin;
          await storage.updateUser(userId, { 
            isAdmin: newAdminStatus,
            adminSetBy: req.session.userId,
            adminSetAt: new Date(),
             adminPin: newAdminStatus && value ? await bcrypt.hash(String(value), 12) : null,
          });
          await storage.logAdminAction(req.session.userId!, "toggle_admin", userId, `Admin: ${newAdminStatus}`);
          break;
        case "update-admin-pin":
          if (!adminUser?.isSuperAdmin) {
            return res.status(403).json({ message: "Action restricted to the super admin" });
          }
           if (typeof value !== "string" || !/^\d{4,12}$/.test(value)) {
             return res.status(400).json({ message: "PIN must contain 4 to 12 digits" });
           }
           await storage.updateUser(userId, { adminPin: await bcrypt.hash(value, 12) });
          await storage.logAdminAction(req.session.userId!, "update_admin_pin", userId, `Admin PIN updated`);
          break;
        case "toggle-password-required":
          if (!adminUser?.isSuperAdmin) {
            return res.status(403).json({ message: "Action restricted to the super admin" });
          }
          await storage.updateUser(userId, { isAdminPasswordRequired: value });
          await storage.logAdminAction(req.session.userId!, "toggle_password_required", userId, `Admin password required: ${value}`);
          break;
        case "assign-product":
          await storage.purchaseProduct(userId, value, true);
          await storage.logAdminAction(req.session.userId!, "assign_product", userId, `Product ${value} assigned`);
          break;
        case "revoke-product":
          await storage.removeUserProduct(userId, value);
          await storage.logAdminAction(req.session.userId!, "revoke_product", userId, `Product ${value} revoked`);
          break;
        case "toggle-super-admin":
          if (!adminUser?.isSuperAdmin) {
            return res.status(403).json({ message: "Action restricted to the super admin" });
          }
          const userSA = await storage.getUser(userId);
          const newSuperAdminStatus = !userSA?.isSuperAdmin;
          await storage.updateUser(userId, {
            isSuperAdmin: newSuperAdminStatus,
            isAdmin: newSuperAdminStatus ? true : userSA?.isAdmin,
          });
          await storage.logAdminAction(req.session.userId!, "toggle_super_admin", userId, `Super Admin: ${newSuperAdminStatus}`);
          break;
        case "toggle-banker":
          if (!adminUser?.isSuperAdmin && !adminUser?.isAdmin) {
            return res.status(403).json({ message: "Action restricted to administrators" });
          }
          const userBanker = await storage.getUser(userId);
          const newBankerStatus = !userBanker?.isBanker;
          await storage.updateUser(userId, { 
            isBanker: newBankerStatus,
            bankerSetBy: newBankerStatus ? req.session.userId : null,
          });
          await storage.logAdminAction(req.session.userId!, "toggle_banker", userId, `Banker: ${newBankerStatus}`);
          break;
        default:
          return res.status(400).json({ message: "Invalid action" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/products/all", requireAdmin, async (req, res) => {
    try {
      const allProducts = await storage.getProducts();
      res.json(allProducts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users/:id/products", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(getRouteParam(req, "id"));
      const userProductsList = await storage.getAllUserProducts(userId);
      res.json(userProductsList.map(up => ({
        id: up.userProduct.id,
        productId: up.userProduct.productId,
        productName: up.product.name,
        productPrice: up.product.price,
        dailyEarnings: up.product.dailyEarnings,
        isActive: up.userProduct.isActive,
        purchaseDate: up.userProduct.purchaseDate,
        daysClaimed: up.product.cycleDays - up.userProduct.daysRemaining,
        totalCycle: up.product.cycleDays,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const { name, price, dailyEarnings, cycleDays, imageUrl } = req.body;
      if (!name || !price || !dailyEarnings || !cycleDays) {
        return res.status(400).json({ message: "Required fields are missing" });
      }
      const priceInt = parseInt(price);
      const dailyInt = parseInt(dailyEarnings);
      const cycleInt = parseInt(cycleDays);
      const product = await storage.createProduct({
        name,
        price: priceInt,
        dailyEarnings: dailyInt,
        cycleDays: cycleInt,
        totalReturn: dailyInt * cycleInt,
        imageUrl: imageUrl || null,
        isFree: false,
        isActive: true,
        sortOrder: 0,
      });
      await storage.logAdminAction(req.session.userId!, "create_product", null, `Product ${product.name} created`);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const product = await storage.updateProduct(parseInt(getRouteParam(req, "id")), req.body);
      await storage.logAdminAction(req.session.userId!, "update_product", null, `Product ${product.id} updated`);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req, "id"));
      await storage.deleteProduct(id);
      await storage.logAdminAction(req.session.userId!, "delete_product", null, `Product ${id} deleted`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/channels", requireAdmin, async (req, res) => {
    try {
      const channels = await storage.getPaymentChannels();
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/channels", requireAdmin, async (req, res) => {
    try {
      const channel = await storage.createPaymentChannel({
        ...req.body,
        modifiedBy: req.session.userId,
      });
      await storage.logAdminAction(req.session.userId!, "create_channel", null, `Channel ${channel.name} created`);
      res.json(channel);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/admin/channels/:id", requireAdmin, async (req, res) => {
    try {
      const channel = await storage.updatePaymentChannel(parseInt(getRouteParam(req, "id")), {
        ...req.body,
        modifiedBy: req.session.userId,
      });
      await storage.logAdminAction(req.session.userId!, "update_channel", null, `Channel ${channel.name} updated`);
      res.json(channel);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/channels/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePaymentChannel(parseInt(getRouteParam(req, "id")));
      await storage.logAdminAction(req.session.userId!, "delete_channel", null, `Channel deleted`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(adminSettings(settings));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/blocked-ips", requireAdmin, async (_req, res) => {
    try {
      res.json(getBlockedIps(await storage.getSetting("blockedIps")));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/blocked-ips", requireAdmin, async (req, res) => {
    try {
      const ip = String(req.body?.ip || "").trim();
      const net = await import("net");
      if (!net.isIP(ip)) return res.status(400).json({ message: "Invalid IP address" });
      const blockedIps = getBlockedIps(await storage.getSetting("blockedIps"));
      if (!blockedIps.includes(ip)) {
        blockedIps.push(ip);
        await storage.setSetting("blockedIps", JSON.stringify(blockedIps), req.session.userId);
      }
      await storage.logAdminAction(req.session.userId!, "block_ip", null, `IP address blocked: ${ip}`);
      res.json({ success: true, ip });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/blocked-ips/:ip", requireAdmin, async (req, res) => {
    try {
      const ip = decodeURIComponent(getRouteParam(req, "ip"));
      const blockedIps = getBlockedIps(await storage.getSetting("blockedIps"));
      const nextIps = blockedIps.filter((value) => value !== ip);
      await storage.setSetting("blockedIps", JSON.stringify(nextIps), req.session.userId);
      await storage.logAdminAction(req.session.userId!, "unblock_ip", null, `IP address unblocked: ${ip}`);
      res.json({ success: true, ip });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const entries = Object.entries(req.body);
      for (const [key, value] of entries) {
        if (!ADMIN_SETTING_KEYS.has(key)) continue;
        if (SENSITIVE_SETTING_KEYS.has(key) && (value === "" || value === MASKED_SETTING_VALUE)) continue;
        await storage.setSetting(key, value as string, req.session.userId);
      }
      await storage.logAdminAction(req.session.userId!, "update_settings", null, `Settings updated`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Reset stats route (Super Admin only)
  app.post("/api/admin/reset-stats", requireAdmin, async (req, res) => {
    try {
      const adminUser = await storage.getUser(req.session.userId!);
      if (!adminUser?.isSuperAdmin) {
        return res.status(403).json({ message: "Action restricted to the super admin" });
      }

      await storage.resetStats();
      await storage.logAdminAction(req.session.userId!, "reset_stats", null, "Platform statistics reset");
      res.json({ success: true, message: "Statistics reset" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Gift Codes Routes
  app.get("/api/admin/gift-codes", requireAdmin, async (req, res) => {
    try {
      const codes = await storage.getAllGiftCodes();
      res.json(codes);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const createGiftCodeSchema = z.object({
    code: z.string().min(1, "Code is required"),
    amount: z.number().positive("Amount must be positive").or(z.string().transform(Number)),
    maxUses: z.number().int().positive("Maximum uses must be positive"),
    expiresAt: z.string().refine((val) => !isNaN(Date.parse(val)), "Expiration date is invalid"),
  });

  app.post("/api/admin/gift-codes", requireAdmin, async (req, res) => {
    try {
      const parseResult = createGiftCodeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.errors[0]?.message || "Invalid data" });
      }

      const { code, amount, maxUses, expiresAt } = parseResult.data;

      const existingCode = await storage.getGiftCodeByCode(code);
      if (existingCode) {
        return res.status(400).json({ message: "This code already exists" });
      }

      const giftCode = await storage.createGiftCode({
        code,
        amount: amount.toString(),
        maxUses,
        expiresAt: new Date(expiresAt),
        createdBy: req.session.userId!,
      });

      await storage.logAdminAction(req.session.userId!, "create_gift_code", null, `Gift code created: ${code} - ${amount} PHP base`);
      res.json(giftCode);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/gift-codes/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req, "id"));
      await storage.deleteGiftCode(id);
      await storage.logAdminAction(req.session.userId!, "delete_gift_code", null, `Gift code deleted: #${id}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  const claimGiftCodeSchema = z.object({
    code: z.string().min(1, "Code is required"),
  });

  app.post("/api/gift-codes/claim", requireAuth, async (req, res) => {
    try {
      const parseResult = claimGiftCodeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.errors[0]?.message || "Code is required" });
      }

      const code = parseResult.data.code.trim().toUpperCase();
      const userId = req.session.userId!;

      const giftCode = await storage.getGiftCodeByCode(code);
      if (!giftCode) {
        return res.status(404).json({ message: "Invalid code" });
      }

      if (!giftCode.isActive) {
        return res.status(400).json({ message: "This code is no longer active" });
      }

      if (new Date() > new Date(giftCode.expiresAt)) {
        return res.status(400).json({ message: "This code has expired" });
      }

      if (giftCode.currentUses >= giftCode.maxUses) {
        return res.status(400).json({ message: "This code has reached its usage limit" });
      }

      const hasClaimed = await storage.hasUserClaimedGiftCode(userId, giftCode.id);
      if (hasClaimed) {
        return res.status(400).json({ message: "You have already used this code" });
      }

      await storage.claimGiftCode(userId, giftCode.id, parseFloat(giftCode.amount));
      const user = await storage.getUser(userId);
      const countryCode = user?.country || "PH";
      const localAmount = fromBaseCurrency(parseFloat(giftCode.amount), countryCode);
      
      res.json({ 
        success: true, 
        message: `Congratulations! You received ${localAmount.toLocaleString("en-US")} ${getCurrencyCode(countryCode)}`,
        amount: localAmount,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Countries routes (public)
  app.get("/api/countries", async (req, res) => {
    try {
      const activeCountries = await storage.getActiveCountries();
      res.json(activeCountries.filter((country) =>
        SUPPORTED_COUNTRY_CODES.includes(country.code as typeof SUPPORTED_COUNTRY_CODES[number]),
      ));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/deposit/provider/:country", requireAuth, async (req, res) => {
    try {
      const country = getRouteParam(req, "country").toUpperCase();
      if (!await getActiveCountry(country)) {
        return res.status(404).json({ message: "Country unavailable" });
      }
       const settings = await storage.getSettings();
      const enabledCodes = (value: string | undefined) =>
        (value || "").split(",").map(code => code.trim().toUpperCase()).filter(Boolean);
      const westpayCountries = enabledCodes(settings.westpayCountries);
      const providers: Array<{ provider: "westpay" | "sendavapay" | "ashtechpay" | "seapay"; name: string }> = [];
      if (settings.westpayEnabled === "true" &&
          (westpayCountries.length === 0 || westpayCountries.includes(country))) {
        providers.push({ provider: "westpay", name: settings.westpayChannelName || "WestPay" });
      }
      if (settings.sendavapayEnabled === "true") {
        providers.push({ provider: "sendavapay", name: settings.sendavapayChannelName || "SendavaPay" });
      }
      const ashtechCountries = enabledCodes(settings.ashtechCountries);
      if (settings.ashtechEnabled === "true" && isAshtechConfigured() &&
          (ashtechCountries.length === 0 || ashtechCountries.includes(country))) {
        providers.push({ provider: "ashtechpay", name: settings.ashtechChannelName || "AshtechPay" });
      }
       const seapayCountries = enabledCodes(settings.seapayCountries || process.env.SEAPAY_COUNTRIES || "PH");
       if (isSeapayEnabled(settings, country) && seapayCountries.includes(country)) {
        providers.push({ provider: "seapay", name: settings.seapayChannelName || "SeaPay" });
      }
      if (providers.length === 0) {
        return res.status(503).json({ message: "No automatic deposit provider is configured for this country" });
      }
      return res.json({ ...providers[0], providers });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // SeaPay Pay-In — create the local pending deposit before redirecting to the
  // hosted checkout. SeaPay receives the member's local amount; the ledger
  // keeps the converted PHP amount.
  app.post("/api/seapay/create", requireAuth, async (req, res) => {
    try {
      const { amount, country, operatorName } = req.body;
      const user = await storage.getUser(req.session.userId!);
      const countryCode = String(country || "").trim().toUpperCase();
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (user.country !== countryCode) {
        return res.status(400).json({ message: "The deposit must be made for your account country" });
      }
      const settings = await storage.getSettings();
      const seapayCountries = (settings.seapayCountries || process.env.SEAPAY_COUNTRIES || "PH")
        .split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
      if (!seapayCountries.includes(countryCode)) {
        return res.status(400).json({ message: "SeaPay is not available for this country" });
      }
      const activeCountry = await getActiveCountry(countryCode);
      if (!activeCountry || !await isActiveCountryOperator(countryCode, operatorName)) {
        return res.status(400).json({ message: "This operator is not available in this country" });
      }
      const requestedAmount = Number(amount);
      const minimum = fromBaseCurrency(
        parseInt(getBaseSettingForCountry(settings, "minDeposit", countryCode, "320")),
        countryCode,
      );
      if (!Number.isFinite(requestedAmount) || requestedAmount < minimum) {
        return res.status(400).json({
          message: `Minimum amount: ${minimum.toLocaleString("en-US")} ${getCurrencyCode(countryCode)}`,
        });
      }

      const merchantOrderNo = `Intel-${Date.now()}-${user.id}`;
      const notifyUrl = getSeapayNotifyUrl(countryCode, "deposit");
      const payType = getSeapayPayType(countryCode, String(operatorName).trim());
      const deposit = await storage.createDeposit({
        userId: user.id,
        amount: toBaseCurrency(requestedAmount, countryCode),
        accountName: user.fullName,
        accountNumber: user.phone,
        country: countryCode,
        paymentMethod: String(operatorName).trim(),
        channelName: "SeaPay",
        status: "processing",
        seapayReference: merchantOrderNo,
        seapayRequestPayload: JSON.stringify(buildSeapayPayinPayload({
          merchantOrderNo,
          amount: requestedAmount,
          currency: getCurrencyCode(countryCode),
          payType,
          notifyUrl,
          country: countryCode,
        })),
      });

      try {
        const payin = await seapayCreatePayin({
          merchantOrderNo,
          amount: requestedAmount,
          currency: getCurrencyCode(countryCode),
          payType,
          notifyUrl,
          country: countryCode,
        });
        await storage.updateDeposit(deposit.id, {
          seapayOrderId: payin.order_no,
          seapayPayUrl: payin.pay_url,
        });
        return res.json({
          depositId: deposit.id,
          merchantOrderNo,
          payUrl: payin.pay_url,
          expiresAt: payin.expires_at || null,
        });
      } catch (error) {
        await storage.updateDeposit(deposit.id, { status: "rejected", processedAt: new Date() });
        throw error;
      }
    } catch (error: any) {
      console.error("[seapay] create pay-in error:", error);
      res.status(502).json({ message: error.message || "SeaPay payment unavailable" });
    }
  });

  app.get("/api/deposits/:id/seapay-status", requireAuth, async (req, res) => {
    try {
      const deposit = await storage.getDeposit(parseInt(getRouteParam(req, "id")));
      if (!deposit) return res.status(404).json({ message: "Deposit not found" });
      if (deposit.userId !== req.session.userId) return res.status(403).json({ message: "Access denied" });
      if (deposit.status === "approved" || deposit.status === "rejected") {
        return res.json({ status: deposit.status });
      }
      if (!deposit.seapayReference) return res.json({ status: deposit.status });

      const data = await seapayQueryPayin(deposit.seapayReference, deposit.country);
      const newStatus = mapSeapayStatus(data.status);
      if (newStatus === "approved" && deposit.status !== "approved") {
        if (!matchesSeapayDepositAmount(deposit, data.amount, data.currency)) {
          console.error(`[seapay] Amount/currency mismatch for deposit ${deposit.id}`);
          return res.status(502).json({ message: "SeaPay payment verification failed" });
        }
        const claimedDeposit = await storage.claimDepositApproval(deposit.id);
        if (claimedDeposit) await creditApprovedDeposit(claimedDeposit);
      } else if (newStatus === "rejected" && deposit.status !== "rejected") {
        await storage.updateDeposit(deposit.id, { status: "rejected", processedAt: new Date() });
      }
      res.json({ status: newStatus === "pending" ? deposit.status : newStatus, rawStatus: data.status });
    } catch (error: any) {
      console.error("[seapay] status check error:", error);
      res.status(502).json({ message: error.message || "SeaPay status unavailable" });
    }
  });

  app.get("/api/banker/withdrawals/:id/seapay-status", requireBanker, async (req, res) => {
    try {
      const withdrawalId = parseInt(getRouteParam(req, "id"));
      const withdrawal = (await storage.getWithdrawals()).find((item) => item.id === withdrawalId);
      if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });
      if (withdrawal.status === "approved" || withdrawal.status === "rejected") {
        return res.json({ status: withdrawal.status });
      }
      if (!withdrawal.seapayPayoutReference) return res.json({ status: withdrawal.status });

      const data = await seapayQueryPayout(withdrawal.seapayPayoutReference, withdrawal.country);
      const newStatus = mapSeapayStatus(data.status);
      if (newStatus === "approved" && withdrawal.status !== "approved") {
        await storage.claimWithdrawalApproval(withdrawal.id, {
          status: "approved",
          processedAt: new Date(),
          seapayPayoutOrderId: data.order_no || null,
        });
      } else if (newStatus === "rejected" && withdrawal.status !== "rejected") {
        const rejected = await storage.claimWithdrawalRejection(withdrawal.id, {
          status: "rejected",
          processedAt: new Date(),
          seapayPayoutOrderId: data.order_no || null,
        });
        if (rejected) await refundWithdrawal(withdrawal);
      }
      res.json({ status: newStatus === "pending" ? withdrawal.status : newStatus, rawStatus: data.status });
    } catch (error: any) {
      console.error("[seapay] payout status check error:", error);
      res.status(502).json({ message: error.message || "SeaPay payout status unavailable" });
    }
  });

  app.post(["/api/webhooks/seapay", "/api/seapay/callback/deposit"], async (req, res) => {
    const acknowledge = () => res.type("text/plain").status(200).send("ok");
    try {
      const payload = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const signature = String(payload.sign || req.headers["x-seapay-signature"] || "").trim();
      if (!verifySeapaySignature(payload, signature)) {
        console.warn("[seapay webhook] Invalid signature");
        return res.status(401).json({ message: "Invalid signature" });
      }
      if (!isKnownSeapayMerchant(payload.merchant_id, "apiKey")) {
        console.warn("[seapay webhook] Merchant mismatch");
        return res.status(401).json({ message: "Invalid merchant" });
      }
      const reference = String(payload.merchant_order_no || "").trim();
      if (!reference) return acknowledge();
      const deposit = await storage.getDepositBySeapayReference(reference);
      if (!deposit || deposit.status === "approved" || deposit.status === "rejected") return acknowledge();

      const status = mapSeapayStatus(String(payload.status || ""));
      if (status === "approved") {
        if (!matchesSeapayDepositAmount(deposit, payload.amount, payload.currency)) {
          console.error(`[seapay webhook] Amount/currency mismatch for deposit ${deposit.id}`);
          return res.status(400).json({ message: "Invalid payment amount" });
        }
        const claimedDeposit = await storage.claimDepositApproval(deposit.id);
        if (claimedDeposit) await creditApprovedDeposit(claimedDeposit);
      } else if (status === "rejected") {
        await storage.updateDeposit(deposit.id, { status: "rejected", processedAt: new Date() });
      }
      return acknowledge();
    } catch (error: any) {
      console.error("[seapay webhook] error:", error);
      return res.status(500).json({ message: error.message || "SeaPay webhook error" });
    }
  });

  app.post("/api/seapay/callback/withdrawal", async (req, res) => {
    const acknowledge = () => res.type("text/plain").status(200).send("ok");
    try {
      const payload = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
      const signature = String(payload.sign || req.headers["x-seapay-signature"] || "").trim();
      if (!verifySeapayPayoutSignature(payload, signature)) {
        console.warn("[seapay payout webhook] Invalid signature");
        return res.status(401).json({ message: "Invalid signature" });
      }
      if (!isKnownSeapayMerchant(payload.merchant_id, "apiSecret")) {
        return res.status(401).json({ message: "Invalid merchant" });
      }

      const reference = String(payload.merchant_order_no || "").trim();
      if (!reference) return acknowledge();
      const withdrawal = await storage.getWithdrawalBySeapayPayoutReference(reference);
      if (!withdrawal || withdrawal.status === "approved" || withdrawal.status === "rejected") return acknowledge();

      const status = mapSeapayStatus(String(payload.status || ""));
      if (status === "approved") {
        await storage.claimWithdrawalApproval(withdrawal.id, {
          status: "approved",
          processedAt: new Date(),
          seapayPayoutOrderId: payload.order_no ? String(payload.order_no) : null,
        });
      } else if (status === "rejected") {
        const rejected = await storage.claimWithdrawalRejection(withdrawal.id, {
          status: "rejected",
          processedAt: new Date(),
          seapayPayoutOrderId: payload.order_no ? String(payload.order_no) : null,
        });
        if (rejected) await refundWithdrawal(withdrawal);
      }
      return acknowledge();
    } catch (error: any) {
      console.error("[seapay payout webhook] error:", error);
      return res.status(500).json({ message: error.message || "SeaPay payout webhook error" });
    }
  });

  // Admin country routes
  app.get("/api/admin/countries", requireAdmin, async (req, res) => {
    try {
      res.json(await storage.getCountries());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/countries", requireAdmin, async (req, res) => {
    try {
      const { code, name, currency, phonePrefix, operators, isActive } = req.body;
      const normalizedCode = String(code || "").trim().toUpperCase();
      if (!SUPPORTED_COUNTRY_CODES.includes(normalizedCode as typeof SUPPORTED_COUNTRY_CODES[number])) {
        return res.status(400).json({ message: "Only supported countries can be added" });
      }
      if (!name || !currency || !phonePrefix || typeof operators !== "string") {
        return res.status(400).json({ message: "All fields are required" });
      }
      const normalizedOperators = normalizeCountryOperators(operators);
      if (normalizedOperators === undefined) {
        return res.status(400).json({ message: "Operators must be a valid JSON array" });
      }
      const country = await storage.createCountry({
        code: normalizedCode, name: String(name).trim(), currency: String(currency).trim().toUpperCase(),
        phonePrefix: String(phonePrefix).replace(/\D/g, ""), operators: normalizedOperators, isActive: isActive !== false,
      });
      res.json(country);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/admin/countries/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(getRouteParam(req, "id"));
      const { code, name, currency, phonePrefix, operators, isActive } = req.body;
      const existing = await storage.getCountry(id);
      if (!existing) {
        return res.status(404).json({ message: "Country configuration not found" });
      }
      const updateData: any = {};
      if (code !== undefined) {
        const normalizedCode = String(code).trim().toUpperCase();
        if (!SUPPORTED_COUNTRY_CODES.includes(normalizedCode as typeof SUPPORTED_COUNTRY_CODES[number])) {
          return res.status(400).json({ message: "Country code is not supported" });
        }
        updateData.code = normalizedCode;
      }
      if (name !== undefined) updateData.name = String(name).trim();
      if (currency !== undefined) updateData.currency = String(currency).trim().toUpperCase();
      if (phonePrefix !== undefined) updateData.phonePrefix = String(phonePrefix).replace(/\D/g, "");
      if (operators !== undefined) {
        const normalizedOperators = normalizeCountryOperators(operators);
        if (normalizedOperators === undefined) {
          return res.status(400).json({ message: "Operators must be a valid JSON array" });
        }
        updateData.operators = normalizedOperators;
      }
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      const country = await storage.updateCountry(id, updateData);
      res.json(country);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/countries/:id", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getCountry(parseInt(getRouteParam(req, "id")));
      if (!existing) return res.status(404).json({ message: "Country configuration not found" });
      await storage.updateCountry(existing.id, { isActive: false });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==================== BANKER ROUTES ====================
  // Accessible to both admins and bankers

  app.get("/api/banker/deposits", requireBanker, async (req, res) => {
    try {
      const banker = await storage.getUser(req.session.userId!);
      const deposits = (await storage.getDeposits()).filter((deposit) =>
        banker?.isAdmin || deposit.country === banker?.country,
      );
      res.json(deposits.map((deposit) => ({
        ...deposit,
        user: deposit.user ? publicUser(deposit.user) : undefined,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/banker/withdrawals", requireBanker, async (req, res) => {
    try {
      const banker = await storage.getUser(req.session.userId!);
      const withdrawals = (await storage.getWithdrawals()).filter((withdrawal) =>
        banker?.isAdmin || withdrawal.country === banker?.country,
      );
      res.json(withdrawals.map((withdrawal) => ({
        ...withdrawal,
        user: withdrawal.user ? publicUser(withdrawal.user) : undefined,
        seapayPayoutAvailable: isSeapayPayoutEnabled(withdrawal.country),
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/banker/deposits/:id/approve", requireBanker, async (req, res) => {
    try {
      const depositId = parseInt(getRouteParam(req, "id"));
      const banker = await storage.getUser(req.session.userId!);
      const availableDeposit = await storage.getDeposit(depositId);
      if (!availableDeposit) return res.status(404).json({ message: "Deposit not found" });
      if (!banker?.isAdmin && banker?.country !== availableDeposit.country) {
        return res.status(403).json({ message: "This deposit belongs to another banker country" });
      }
      const deposit = await storage.claimAdminDepositApproval(depositId, req.session.userId!);
      if (!deposit) return res.status(409).json({ message: "This deposit is already approved or unavailable" });
      const user = await storage.getUser(deposit.userId);
      if (user) {
        const credited = await storage.creditDeposit(user.id, deposit.amount, "Deposit approved by banker");
        if (credited) await storage.processDepositReferralCommissions(deposit.userId, deposit.amount);
      }
      await storage.logAdminAction(req.session.userId!, "approve_deposit", deposit.userId, `Deposit ${deposit.id} approved by banker: ${amountForCountry(deposit.amount, deposit.country)}`);
      res.json(deposit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/banker/deposits/:id/reject", requireBanker, async (req, res) => {
    try {
      const depositId = parseInt(getRouteParam(req, "id"));
      const banker = await storage.getUser(req.session.userId!);
      const availableDeposit = await storage.getDeposit(depositId);
      if (!availableDeposit) return res.status(404).json({ message: "Deposit not found" });
      if (!banker?.isAdmin && banker?.country !== availableDeposit.country) {
        return res.status(403).json({ message: "This deposit belongs to another banker country" });
      }
      const deposit = await storage.updateDeposit(depositId, {
        status: "rejected",
        processedAt: new Date(),
        processedBy: req.session.userId,
        screenshot: null,
      });
      await storage.logAdminAction(req.session.userId!, "reject_deposit", deposit.userId, `Deposit ${deposit.id} rejected by banker`);
      res.json(deposit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/banker/withdrawals/:id/approve", requireBanker, async (req, res) => {
    try {
      const allWithdrawals = await storage.getWithdrawals();
      const withdrawalData = allWithdrawals.find(w => w.id === parseInt(getRouteParam(req, "id")));
      if (!withdrawalData) return res.status(404).json({ message: "Withdrawal not found" });
      const banker = await storage.getUser(req.session.userId!);
      if (!banker?.isAdmin && banker?.country !== withdrawalData.country) {
        return res.status(403).json({ message: "This withdrawal belongs to another banker country" });
      }
      const withdrawal = await storage.claimWithdrawalApproval(parseInt(getRouteParam(req, "id")), {
        status: "approved",
        processedAt: new Date(),
        processedBy: req.session.userId,
      });
      if (!withdrawal) return res.status(409).json({ message: "This withdrawal is already processed" });
      await storage.logAdminAction(req.session.userId!, "approve_withdrawal", withdrawalData.userId, `Withdrawal ${withdrawal.id} approved by banker: ${amountForCountry(withdrawalData.netAmount, withdrawalData.country)}`);
      res.json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/banker/withdrawals/:id/reject", requireBanker, async (req, res) => {
    try {
      const allWithdrawals = await storage.getWithdrawals();
      const withdrawalData = allWithdrawals.find(w => w.id === parseInt(getRouteParam(req, "id")));
      if (!withdrawalData) return res.status(404).json({ message: "Withdrawal not found" });
      const banker = await storage.getUser(req.session.userId!);
      if (!banker?.isAdmin && banker?.country !== withdrawalData.country) {
        return res.status(403).json({ message: "This withdrawal belongs to another banker country" });
      }
      const withdrawal = await storage.claimWithdrawalRejection(parseInt(getRouteParam(req, "id")), {
        status: "rejected",
        processedAt: new Date(),
        processedBy: req.session.userId,
      });
      if (!withdrawal) return res.status(409).json({ message: "This withdrawal is already processed" });
      await refundWithdrawal(withdrawal);
      await storage.logAdminAction(req.session.userId!, "reject_withdrawal", withdrawal.userId, `Withdrawal ${withdrawal.id} rejected by banker and refunded`);
      res.json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
