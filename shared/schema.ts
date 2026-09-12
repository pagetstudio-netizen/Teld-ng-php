import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, serial, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Countries table (admin-managed)
export const countries = pgTable("countries", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  phonePrefix: text("phone_prefix").notNull(),
  operators: text("operators").notNull().default("[]"), // JSON array string
  isActive: boolean("is_active").notNull().default(true),
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  password: text("password").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  referredBy: text("referred_by"),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull().default("816"),
  todayEarnings: decimal("today_earnings", { precision: 15, scale: 2 }).notNull().default("0"),
  totalEarnings: decimal("total_earnings", { precision: 15, scale: 2 }).notNull().default("0"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  isWithdrawalBlocked: boolean("is_withdrawal_blocked").notNull().default(false),
  isPromoter: boolean("is_promoter").notNull().default(false),
  mustInviteToWithdraw: boolean("must_invite_to_withdraw").notNull().default(false),
  hasDeposited: boolean("has_deposited").notNull().default(false),
  hasActiveProduct: boolean("has_active_product").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastFreeProductClaim: timestamp("last_free_product_claim"),
  lastDailyBonusClaim: timestamp("last_daily_bonus_claim"),
  promoterSetBy: integer("promoter_set_by"),
  adminSetBy: integer("admin_set_by"),
  adminSetAt: timestamp("admin_set_at"),
  adminPin: text("admin_pin"),
  isAdminPasswordRequired: boolean("is_admin_password_required").notNull().default(true),
  isBanker: boolean("is_banker").notNull().default(false),
  bankerSetBy: integer("banker_set_by"),
}, (table) => ({
  countryPhoneUnique: unique("users_country_phone_unique").on(table.country, table.phone),
}));

// Withdrawal wallets
export const withdrawalWallets = pgTable("withdrawal_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  paymentMethod: text("payment_method").notNull(),
  country: text("country").notNull(),
  isDefault: boolean("is_default").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  dailyEarnings: integer("daily_earnings").notNull(),
  cycleDays: integer("cycle_days").notNull().default(80),
  totalReturn: integer("total_return").notNull(),
  imageUrl: text("image_url"),
  isFree: boolean("is_free").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// User products (investments)
export const userProducts = pgTable("user_products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  purchaseDate: timestamp("purchase_date").notNull().defaultNow(),
  lastEarningDate: timestamp("last_earning_date"),
  daysRemaining: integer("days_remaining").notNull(),
  totalEarned: decimal("total_earned", { precision: 15, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  assignedByAdmin: boolean("assigned_by_admin").notNull().default(false),
});

// Deposits
export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  country: text("country").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentChannelId: integer("payment_channel_id"),
  paymentNumberId: integer("payment_number_id"),
  channelName: text("channel_name"),
  screenshot: text("screenshot"),
  paymentMessage: text("payment_message"),
  reference: text("reference"),
  status: text("status").notNull().default("pending"),
  soleaspayReference: text("soleaspay_reference"),
  soleaspayOrderId: text("soleaspay_order_id"),
  inpayOrderNumber: text("inpay_order_number"),
  inpayOutTradeNo: text("inpay_out_trade_no"),
  omnipayId: text("omnipay_id"),
  omnipayReference: text("omnipay_reference"),
  sendavapayReference: text("sendavapay_reference"),
  sendavapayToken: text("sendavapay_token"),
  westpayReference: text("westpay_reference"),
  seapayReference: text("seapay_reference"),
  seapayOrderId: text("seapay_order_id"),
  seapayPayUrl: text("seapay_pay_url"),
  seapayRequestPayload: text("seapay_request_payload"),
  ashtechTransactionId: text("ashtech_transaction_id"),
  ashtechReference: text("ashtech_reference"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by"),
});

// Withdrawals
export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  netAmount: integer("net_amount").notNull(),
  fees: integer("fees").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  country: text("country").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull().default("pending"),
  inpayOrderNumber: text("inpay_order_number"),
  inpayOutTradeNo: text("inpay_out_trade_no"),
  omnipayId: text("omnipay_id"),
  omnipayReference: text("omnipay_reference"),
  seapayPayoutReference: text("seapay_payout_reference"),
  seapayPayoutOrderId: text("seapay_payout_order_id"),
  seapayPayoutRequestPayload: text("seapay_payout_request_payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by"),
});

// Payment channels (kept for withdrawal compatibility)
export const paymentChannels = pgTable("payment_channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  redirectUrl: text("redirect_url").notNull(),
  isApi: boolean("is_api").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  modifiedBy: integer("modified_by"),
  modifiedAt: timestamp("modified_at"),
});

// Staking products (created by admin, locked funds)
export const stakingProducts = pgTable("staking_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  returnAmount: integer("return_amount").notNull(),
  lockDays: integer("lock_days").notNull(),
  launchDate: timestamp("launch_date"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by"),
});
export type StakingProduct = typeof stakingProducts.$inferSelect;
export type InsertStakingProduct = typeof stakingProducts.$inferInsert;

// User stakings (purchases)
export const userStakings = pgTable("user_stakings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  stakingProductId: integer("staking_product_id").notNull().references(() => stakingProducts.id),
  amountPaid: integer("amount_paid").notNull(),
  returnAmount: integer("return_amount").notNull(),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
  releaseDate: timestamp("release_date").notNull(),
  status: text("status").notNull().default("active"),
  releasedAt: timestamp("released_at"),
});
export type UserStaking = typeof userStakings.$inferSelect;
export type InsertUserStaking = typeof userStakings.$inferInsert;

// Payment numbers (new deposit system)
export const paymentNumbers = pgTable("payment_numbers", {
  id: serial("id").primaryKey(),
  ownerName: text("owner_name").notNull(),
  phone: text("phone").notNull(),
  operatorName: text("operator_name").notNull(),
  country: text("country").notNull(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by"),
});
export type PaymentNumber = typeof paymentNumbers.$inferSelect;
export type InsertPaymentNumber = typeof paymentNumbers.$inferInsert;

// Referral commissions
export const referralCommissions = pgTable("referral_commissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  fromUserId: integer("from_user_id").notNull().references(() => users.id),
  level: integer("level").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  productId: integer("product_id").references(() => products.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  firstInvestmentCommissionUnique: unique("referral_commissions_source_level_product_unique")
    .on(table.fromUserId, table.level, table.productId),
}));

// Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  requiredInvites: integer("required_invites").notNull(),
  reward: integer("reward").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// User completed tasks
export const userTasks = pgTable("user_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  taskId: integer("task_id").notNull().references(() => tasks.id),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
  rewardClaimed: boolean("reward_claimed").notNull().default(true),
}, (table) => ({
  userTaskUnique: unique("user_tasks_user_task_unique").on(table.userId, table.taskId),
}));

// Transaction history
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Platform settings
export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  modifiedBy: integer("modified_by"),
  modifiedAt: timestamp("modified_at"),
});

// Admin audit log
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  targetUserId: integer("target_user_id"),
  details: text("details").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Gift codes
export const giftCodes = pgTable("gift_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  maxUses: integer("max_uses").notNull(),
  currentUses: integer("current_uses").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
});

// Gift code claims
export const giftCodeClaims = pgTable("gift_code_claims", {
  id: serial("id").primaryKey(),
  giftCodeId: integer("gift_code_id").notNull().references(() => giftCodes.id),
  userId: integer("user_id").notNull().references(() => users.id),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
}, (table) => ({
  giftCodeUserUnique: unique("gift_code_claims_gift_code_user_unique").on(table.giftCodeId, table.userId),
}));

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  products: many(userProducts),
  deposits: many(deposits),
  withdrawals: many(withdrawals),
  wallets: many(withdrawalWallets),
  commissionsReceived: many(referralCommissions, { relationName: "receiver" }),
  commissionsGiven: many(referralCommissions, { relationName: "giver" }),
  tasks: many(userTasks),
  transactions: many(transactions),
  referrer: one(users, {
    fields: [users.referredBy],
    references: [users.referralCode],
    relationName: "referrals",
  }),
  referrals: many(users, { relationName: "referrals" }),
}));

export const userProductsRelations = relations(userProducts, ({ one }) => ({
  user: one(users, { fields: [userProducts.userId], references: [users.id] }),
  product: one(products, { fields: [userProducts.productId], references: [products.id] }),
}));

export const depositsRelations = relations(deposits, ({ one }) => ({
  user: one(users, { fields: [deposits.userId], references: [users.id] }),
  channel: one(paymentChannels, { fields: [deposits.paymentChannelId], references: [paymentChannels.id] }),
}));

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  user: one(users, { fields: [withdrawals.userId], references: [users.id] }),
}));

export const referralCommissionsRelations = relations(referralCommissions, ({ one }) => ({
  receiver: one(users, { fields: [referralCommissions.userId], references: [users.id], relationName: "receiver" }),
  giver: one(users, { fields: [referralCommissions.fromUserId], references: [users.id], relationName: "giver" }),
  product: one(products, { fields: [referralCommissions.productId], references: [products.id] }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  balance: true,
  todayEarnings: true,
  totalEarnings: true,
  isAdmin: true,
  isSuperAdmin: true,
  isBanned: true,
  isWithdrawalBlocked: true,
  isPromoter: true,
  mustInviteToWithdraw: true,
  hasDeposited: true,
  hasActiveProduct: true,
  createdAt: true,
  lastFreeProductClaim: true,
  promoterSetBy: true,
  adminSetBy: true,
  adminSetAt: true,
});

export const insertCountrySchema = createInsertSchema(countries).omit({ id: true });

export const phoneNumberSchema = z.string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Invalid phone number");

export const supportedCountryCodeSchema = z.enum(["PH", "NG"], {
  errorMap: () => ({ message: "Country is not supported" }),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(100, "Name is too long"),
  phone: phoneNumberSchema,
  country: supportedCountryCodeSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
  invitationCode: z.string().optional(),
});

export const loginSchema = z.object({
  phone: phoneNumberSchema,
  country: supportedCountryCodeSchema,
  password: z.string().min(1, "Password is required"),
});

export const depositSchema = z.object({
  amount: z.number().min(1, "Amount must be positive"),
  accountName: z.string().trim().min(2, "Account name is required").max(100, "Name is too long"),
  accountNumber: phoneNumberSchema,
  country: supportedCountryCodeSchema,
  paymentMethod: z.string().trim().min(2, "Payment method is required").max(60, "Invalid payment method"),
  paymentChannelId: z.number().optional(),
});

export const withdrawalSchema = z.object({
  amount: z.number().min(1, "Amount must be positive"),
});

export const walletSchema = z.object({
  accountName: z.string().trim().min(2, "Account name is required").max(100, "Name is too long"),
  accountNumber: phoneNumberSchema,
  paymentMethod: z.string().trim().min(2, "Payment method is required").max(60, "Invalid payment method"),
  country: supportedCountryCodeSchema,
});

export const giftCodeSchema = z.object({
  code: z.string().min(4, "Code must be at least 4 characters"),
  amount: z.number().min(1, "Amount must be positive"),
  maxUses: z.number().min(1, "Maximum uses must be at least 1"),
  expiresAt: z.string(),
});

// Types
export type Country = typeof countries.$inferSelect;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Product = typeof products.$inferSelect;
export type UserProduct = typeof userProducts.$inferSelect;
export type Deposit = typeof deposits.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type WithdrawalWallet = typeof withdrawalWallets.$inferSelect;
export type PaymentChannel = typeof paymentChannels.$inferSelect;
export type ReferralCommission = typeof referralCommissions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type UserTask = typeof userTasks.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type GiftCode = typeof giftCodes.$inferSelect;
export type GiftCodeClaim = typeof giftCodeClaims.$inferSelect;
