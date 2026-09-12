import { db } from "./db";
import { users, products, tasks, paymentChannels, platformSettings, countries, stakingProducts } from "@shared/schema";
import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { migrateReferralBonusDefaults } from "./referral-bonus-migration";
import { toBaseCurrency } from "@shared/currency";
import { SEAPAY_NIGERIA_BANKS } from "@shared/seapay";

export async function seed() {
  console.log("Seeding database...");

  // Create session table for connect-pg-simple (if not exists)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    ) WITH (OIDS=FALSE)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
  `);

  // Ensure countries table exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "countries" (
      "id" serial PRIMARY KEY,
      "code" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "currency" text NOT NULL,
      "phone_prefix" text NOT NULL,
      "operators" text NOT NULL DEFAULT '[]',
      "is_active" boolean NOT NULL DEFAULT true
    )
  `);
  await db.execute(sql`ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "westpay_reference" text`);
  await db.execute(sql`ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "seapay_reference" text`);
  await db.execute(sql`ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "seapay_order_id" text`);
  await db.execute(sql`ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "seapay_pay_url" text`);
  await db.execute(sql`ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "seapay_request_payload" text`);
  await db.execute(sql`ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "ashtech_transaction_id" text`);
  await db.execute(sql`ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "ashtech_reference" text`);
  await db.execute(sql`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "seapay_payout_reference" text`);
  await db.execute(sql`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "seapay_payout_order_id" text`);
  await db.execute(sql`ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "seapay_payout_request_payload" text`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "gift_code_claims_gift_code_user_unique"
    ON "gift_code_claims" ("gift_code_id", "user_id")
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_tasks_user_task_unique"
    ON "user_tasks" ("user_id", "task_id")
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "referral_commissions_source_level_product_unique"
    ON "referral_commissions" ("from_user_id", "level", "product_id")
  `);

  // Bootstrap credentials must come from the secret store. Never keep a
  // default administrator phone number or PIN in source code.
  const adminPhone = process.env.ADMIN_PHONE?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPin = process.env.ADMIN_PIN;

  if (!adminPhone || !adminPassword || !adminPin) {
    console.warn("Super admin not provisioned; set ADMIN_PHONE, ADMIN_PASSWORD, and ADMIN_PIN in the secret store.");
  } else {
    const existingAdmin = await db.select().from(users).where(eq(users.phone, adminPhone));
    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await db.insert(users).values({
        fullName: "Super Admin",
        phone: adminPhone,
        country: "PH",
        password: hashedPassword,
        referralCode: `ADMIN-${Date.now()}`,
        balance: "0",
        isAdmin: true,
        isSuperAdmin: true,
        adminPin: await bcrypt.hash(adminPin, 12),
      });
      console.log("Super admin created");
      console.log("Super admin PIN configured");
    } else {
      // Always update admin flags and rotate credentials from the secret store.
      const updateData: any = {
        isAdmin: true,
        isSuperAdmin: true,
        // Keep the bootstrap administrator able to use an active login country
        // after legacy countries are retired.
        ...(existingAdmin[0].country !== "PH" ? { country: "PH" } : {}),
        password: await bcrypt.hash(adminPassword, 12),
        adminPin: await bcrypt.hash(adminPin, 12),
      };
      await db.update(users)
        .set(updateData)
        .where(eq(users.phone, adminPhone));
      console.log("Super admin access verified");
      console.log("Super admin credentials updated");
    }
  }

  await migrateReferralBonusDefaults();

  // Keep supported country assignments intact. Any legacy country that is no
  // longer supported is moved to PH so existing accounts can still sign in.
  await db.update(users).set({ country: "PH" }).where(sql`${users.country} NOT IN ('PH', 'NG')`);

  // Canonical user-facing country and operators.
  const canonicalCountries = [
    { code: "PH", name: "Philippines", currency: "PHP", phonePrefix: "63", operators: ["PayMaya", "GCash"] },
    { code: "NG", name: "Nigeria", currency: "NGN", phonePrefix: "234", operators: SEAPAY_NIGERIA_BANKS.map((bank) => bank.name) },
  ];
  const existingCountries = await db.select().from(countries);
  for (const country of canonicalCountries) {
    const existing = existingCountries.find((item) => item.code === country.code);
    if (!existing) {
      await db.insert(countries).values({ ...country, operators: JSON.stringify(country.operators), isActive: true });
    } else if (country.code === "NG") {
      // Migrate only the old built-in operator list. A custom administrator
      // list remains authoritative and is never overwritten on restart.
      let existingOperators: unknown = [];
      try {
        existingOperators = JSON.parse(existing.operators);
      } catch {
        existingOperators = [];
      }
      const wasLegacyDefault =
        Array.isArray(existingOperators) &&
        existingOperators.length === 3 &&
        ["OPay", "PalmPay", "Moniepoint"].every((operator) => existingOperators.includes(operator));
      const wasPreviousSeapayDefault =
        Array.isArray(existingOperators) &&
        existingOperators.length === 5 &&
        ["Access Bank", "GT Bank", "UBA", "First Bank", "Zenith Bank"].every((operator) => existingOperators.includes(operator));
      if (wasLegacyDefault || wasPreviousSeapayDefault) {
        await db.update(countries)
          .set({ operators: JSON.stringify(SEAPAY_NIGERIA_BANKS.map((bank) => bank.name)) })
          .where(eq(countries.id, existing.id));
        console.log("Nigeria operators migrated to SeaPay supported banks");
      }
    }
  }

  // Seed tasks only if table is empty (first install only — never overwrite admin changes)
  const existingTasks = await db.select().from(tasks);
  const legacyTaskTranslations = new Map([
    ["Parrain Bronze", { name: "Bronze referral", description: "Invite 3 people to invest" }],
    ["Parrain Argent", { name: "Silver referral", description: "Invite 5 people to invest" }],
    ["Parrain Or", { name: "Gold referral", description: "Invite 10 people to invest" }],
    ["Parrain Platine", { name: "Platinum referral", description: "Invite 30 people to invest" }],
    ["Parrain Diamant", { name: "Diamond referral", description: "Invite 100 people to invest" }],
    ["Parrain Elite", { name: "Elite referral", description: "Invite 300 people to invest" }],
  ]);
  for (const task of existingTasks) {
    const translation = legacyTaskTranslations.get(task.name);
    if (translation) {
      await db.update(tasks).set(translation).where(eq(tasks.id, task.id));
      console.log(`Task translated: ${task.name} → ${translation.name}`);
    }
  }
  if (existingTasks.length === 0) {
    await db.insert(tasks).values([
      { name: "Bronze referral", description: "Invite 3 people to invest", requiredInvites: 3, reward: 1428, sortOrder: 1 },
      { name: "Silver referral", description: "Invite 5 people to invest", requiredInvites: 5, reward: 3060, sortOrder: 2 },
      { name: "Gold referral", description: "Invite 10 people to invest", requiredInvites: 10, reward: 10200, sortOrder: 3 },
      { name: "Platinum referral", description: "Invite 30 people to invest", requiredInvites: 30, reward: 26520, sortOrder: 4 },
      { name: "Diamond referral", description: "Invite 100 people to invest", requiredInvites: 100, reward: 61200, sortOrder: 5 },
      { name: "Elite referral", description: "Invite 300 people to invest", requiredInvites: 300, reward: 204000, sortOrder: 6 },
    ]);
    console.log("Tasks seeded (first install)");
  } else {
    console.log(`Tasks skipped — ${existingTasks.length} existing tasks preserved`);
  }

  // Check if payment channels exist
  const existingChannels = await db.select().from(paymentChannels);
  if (existingChannels.length === 0) {
    await db.insert(paymentChannels).values([
      { name: "PayMaya", redirectUrl: "#", isApi: false },
      { name: "GCash", redirectUrl: "#", isApi: false },
    ]);
    console.log("Payment channels seeded");
  } else {
    await db.update(paymentChannels).set({ name: "PayMaya" }).where(eq(paymentChannels.name, "LeekPay"));
    await db.update(paymentChannels).set({ name: "GCash" }).where(eq(paymentChannels.name, "FedaPay"));
  }

  // Check if settings exist - apply new values for new keys or update existing
  const existingSettings = await db.select().from(platformSettings);
  const requiredSettings = [
    { key: "supportLink", value: "https://t.me/sybotx" },
    { key: "supportType", value: "telegram" },
    { key: "supportLabel", value: "Customer service" },
    { key: "support2Link", value: "https://t.me/sybotx" },
    { key: "support2Type", value: "telegram" },
    { key: "support2Label", value: "Customer service 2" },
    { key: "channelLink", value: "https://t.me/sybotx" },
    { key: "channelType", value: "telegram" },
    { key: "channelLabel", value: "Official channel" },
    { key: "groupLink", value: "https://t.me/sybotx" },
    { key: "groupType", value: "telegram" },
    { key: "groupLabel", value: "Discussion group" },
    { key: "popupButtonLabel", value: "Click here to join the Telegram group" },
    { key: "noticeText", value: "TELD (Tcharging) is a leading company with one of the country's largest networks of connected charging stations." },
    { key: "supportEnabled", value: "true" },
    { key: "support2Enabled", value: "true" },
    { key: "channelEnabled", value: "true" },
    { key: "groupEnabled", value: "true" },
    { key: "minDeposit", value: "320" },
    { key: "minWithdrawal", value: "100" },
    { key: "withdrawalFees", value: "10" },
    { key: "withdrawalStartHour", value: "9" },
    { key: "withdrawalEndHour", value: "17" },
    { key: "maxWithdrawalsPerDay", value: "1" },
    { key: "level1Commission", value: "20" },
    { key: "level2Commission", value: "5" },
    { key: "level3Commission", value: "2" },
    { key: "signupBonus", value: "40" },
    { key: "minDeposit_NG", value: toBaseCurrency(3700, "NG").toString() },
    { key: "minWithdrawal_NG", value: toBaseCurrency(600, "NG").toString() },
    { key: "signupBonus_NG", value: toBaseCurrency(500, "NG").toString() },
    { key: "soleaspayEnabled", value: "false" },
    { key: "soleaspayCountries", value: "" },
    { key: "soleaspayChannelName", value: "Westpay" },
    { key: "omnipayEnabled", value: "false" },
    { key: "omnipayChannelName", value: "OmniPay" },
    { key: "omnipayCallbackKey", value: "" },
    { key: "sendavapayEnabled", value: "false" },
    { key: "sendavapayChannelName", value: "SendavaPay" },
    { key: "sendavapayWebhookSecret", value: "" },
    { key: "westpayEnabled", value: "false" },
    { key: "westpayChannelName", value: "WestPay" },
    { key: "westpayCountries", value: "PH" },
    { key: "seapayEnabled", value: "false" },
    { key: "seapayCountries", value: "PH,NG" },
    { key: "seapayChannelName", value: "SeaPay" },
    { key: "westpayWebhookSecret", value: "" },
    { key: "ashtechEnabled", value: "false" },
    { key: "ashtechChannelName", value: "AshtechPay" },
    { key: "ashtechCountries", value: "" },
    { key: "ashtechWebhookSecret", value: "" },
  ];
  const legacySettingTranslations: Record<string, string> = {
    supportLabel: "Service client",
    support2Label: "Service client 2",
    channelLabel: "Chaîne officielle",
    groupLabel: "Groupe de discussion",
    popupButtonLabel: "Cliquez ici pour rejoindre le groupe Telegram",
    noticeText: "TELD (Tcharging) est un leader incontournable qui possède l'un des plus grands réseaux de bornes connectées à travers le pays.",
    minDeposit: "12240",
    minWithdrawal: "6120",
    signupBonus: "2040",
    withdrawalEndHour: "17",
  };
  const legacySettingValues: Record<string, string[]> = {
    minDeposit: ["12240", "4000", "3500", "3000"],
    minWithdrawal: ["6120", "1500", "1200"],
    signupBonus: ["2040", "500", "200"],
    withdrawalEndHour: ["17"],
  };
  const forcedDisabledChannels = new Set([
    "soleaspayEnabled", "omnipayEnabled", "sendavapayEnabled", "westpayEnabled", "ashtechEnabled",
  ]);
  const forcedSettingValues: Record<string, string> = { westpayCountries: "PH" };

  for (const settingData of requiredSettings) {
    const existing = existingSettings.find(s => s.key === settingData.key);
    const isSensitive = /secret|key|token|password/i.test(settingData.key);
    if (!existing) {
      await db.insert(platformSettings).values(settingData);
      console.log(`Setting added: ${settingData.key}${isSensitive ? "" : ` = ${settingData.value}`}`);
    } else if (forcedSettingValues[existing.key] !== undefined && existing.value !== forcedSettingValues[existing.key]) {
      await db.update(platformSettings)
        .set({ value: forcedSettingValues[existing.key] })
        .where(eq(platformSettings.key, settingData.key));
      console.log(`Setting enforced: ${settingData.key} = ${forcedSettingValues[existing.key]}`);
    } else if (forcedDisabledChannels.has(existing.key) && existing.value !== settingData.value) {
      await db.update(platformSettings)
        .set({ value: settingData.value })
        .where(eq(platformSettings.key, settingData.key));
      console.log(`Legacy payment provider disabled: ${settingData.key}`);
    } else if (
      legacySettingTranslations[existing.key] === existing.value
      || legacySettingValues[existing.key]?.includes(existing.value)
    ) {
      await db.update(platformSettings)
        .set({ value: settingData.value })
        .where(eq(platformSettings.key, settingData.key));
      console.log(`Setting translated: ${settingData.key} = ${settingData.value}`);
    } else if (
      settingData.key === "noticeText" &&
      /stone by ton|sybotx|disney|walt|pixar|marvel|star wars/i.test(existing.value)
    ) {
      await db.update(platformSettings)
        .set({ value: settingData.value })
        .where(eq(platformSettings.key, settingData.key));
      console.log(`Setting updated: ${settingData.key} = ${settingData.value}`);
    } else {
      console.log(`Setting preserved: ${existing.key}${isSensitive ? "" : ` = ${existing.value}`}`);
    }
  }
  console.log("Settings check complete");

  // Seed staking products only if table is empty (first install only — never overwrite admin changes)
  const canonicalProducts = [
    { name: "Free Bonus", price: 0, dailyEarnings: 10, cycleDays: 100, totalReturn: 1000, isFree: true, sortOrder: 0 },
    { name: "VIP 1", price: 320, dailyEarnings: 64, cycleDays: 100, totalReturn: 6400, isFree: false, sortOrder: 1 },
    { name: "VIP 2", price: 640, dailyEarnings: 135, cycleDays: 100, totalReturn: 13500, isFree: false, sortOrder: 2 },
    { name: "VIP 3", price: 1280, dailyEarnings: 280, cycleDays: 100, totalReturn: 28000, isFree: false, sortOrder: 3 },
    { name: "VIP 4", price: 2560, dailyEarnings: 580, cycleDays: 100, totalReturn: 58000, isFree: false, sortOrder: 4 },
    { name: "VIP 5", price: 5000, dailyEarnings: 1190, cycleDays: 100, totalReturn: 119000, isFree: false, sortOrder: 5 },
    { name: "VIP 6", price: 10000, dailyEarnings: 2500, cycleDays: 100, totalReturn: 250000, isFree: false, sortOrder: 6 },
  ];
  for (const product of canonicalProducts) {
    const [existingProduct] = await db.select().from(products).where(eq(products.name, product.name));
    if (existingProduct) {
      await db.update(products).set(product).where(eq(products.id, existingProduct.id));
    } else {
      await db.insert(products).values(product);
    }
  }
  await db.update(products).set({ isActive: false }).where(eq(products.name, "VIP 7"));
  console.log("Philippines product catalog synchronized");

  // Seed staking products only if table is empty (first install only — never overwrite admin changes)
  const existingStakingProducts = await db.select().from(stakingProducts);
  if (existingStakingProducts.length === 0) {
    await db.insert(stakingProducts).values([
      { name: "Product 1", description: "5% per day for 3 days. Capital recoverable at the end.", price: 8160, returnAmount: 9384, lockDays: 3, isActive: true },
      { name: "Product 2", description: "5% per day for 7 days. Capital recoverable at the end.", price: 20400, returnAmount: 27540, lockDays: 7, isActive: true },
      { name: "Product 3", description: "5% per day for 12 days. Capital recoverable at the end.", price: 40800, returnAmount: 65280, lockDays: 12, isActive: true },
      { name: "Product 4", description: "5% per day for 16 days. Capital recoverable at the end.", price: 81600, returnAmount: 146880, lockDays: 16, isActive: true },
      { name: "Product 5", description: "5% per day for 20 days. Capital recoverable at the end.", price: 204000, returnAmount: 408000, lockDays: 20, isActive: true },
    ]);
    console.log("Staking products seeded (first install)");
  } else {
    console.log(`Staking products skipped — ${existingStakingProducts.length} existing staking products preserved`);
  }

  console.log("Database seeding complete!");
}
