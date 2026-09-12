import pg from "pg";

const { Pool } = pg;

const url = process.env.SUPABASE_DATABASE_URL;
if (!url) throw new Error("SUPABASE_DATABASE_URL manquant");

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    console.log("✅ Connected to Supabase");

    // Session table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
    console.log("✅ Session table created");

    // Countries
    await client.query(`
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
    console.log("✅ Countries table created");

    // Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY,
        "full_name" text NOT NULL,
        "phone" text NOT NULL UNIQUE,
        "country" text NOT NULL,
        "password" text NOT NULL,
        "referral_code" text NOT NULL UNIQUE,
        "referred_by" text,
        "balance" decimal(15,2) NOT NULL DEFAULT 200,
        "today_earnings" decimal(15,2) NOT NULL DEFAULT 0,
        "total_earnings" decimal(15,2) NOT NULL DEFAULT 0,
        "is_admin" boolean NOT NULL DEFAULT false,
        "is_super_admin" boolean NOT NULL DEFAULT false,
        "is_banned" boolean NOT NULL DEFAULT false,
        "is_withdrawal_blocked" boolean NOT NULL DEFAULT false,
        "is_promoter" boolean NOT NULL DEFAULT false,
        "must_invite_to_withdraw" boolean NOT NULL DEFAULT false,
        "has_deposited" boolean NOT NULL DEFAULT false,
        "has_active_product" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "last_free_product_claim" timestamp,
        "last_daily_bonus_claim" timestamp,
        "promoter_set_by" integer,
        "admin_set_by" integer,
        "admin_set_at" timestamp,
        "admin_pin" text,
        "is_admin_password_required" boolean NOT NULL DEFAULT true,
        "is_banker" boolean NOT NULL DEFAULT false,
        "banker_set_by" integer
      )
    `);
    console.log("✅ Users table created");

    // Products
    await client.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "price" integer NOT NULL,
        "daily_earnings" integer NOT NULL,
        "cycle_days" integer NOT NULL DEFAULT 80,
        "total_return" integer NOT NULL,
        "image_url" text,
        "is_free" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0
      )
    `);
    console.log("✅ Products table created");

    // User products
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_products" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "product_id" integer NOT NULL REFERENCES "products"("id"),
        "purchase_date" timestamp NOT NULL DEFAULT now(),
        "last_earning_date" timestamp,
        "earnings_collected" decimal(15,2) NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'active',
        "cycle_end_date" timestamp,
        "total_earnings_target" decimal(15,2) NOT NULL DEFAULT 0
      )
    `);
    console.log("✅ User products table created");

    // Withdrawal wallets
    await client.query(`
      CREATE TABLE IF NOT EXISTS "withdrawal_wallets" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "account_name" text NOT NULL,
        "account_number" text NOT NULL,
        "payment_method" text NOT NULL,
        "country" text NOT NULL,
        "is_default" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✅ Withdrawal wallets table created");

    // Deposits
    await client.query(`
      CREATE TABLE IF NOT EXISTS "deposits" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "amount" decimal(15,2) NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "payment_method" text NOT NULL,
        "country" text NOT NULL,
        "account_name" text,
        "account_number" text,
        "channel_name" text,
        "payment_number_id" integer,
        "screenshot" text,
        "payment_message" text,
        "reference" text,
        "ashtech_transaction_id" text,
        "ashtech_reference" text,
        "admin_note" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✅ Deposits table created");
    await client.query(`ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "ashtech_transaction_id" text`);
    await client.query(`ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "ashtech_reference" text`);
    console.log("✅ AshtechPay columns verified");

    // Withdrawals
    await client.query(`
      CREATE TABLE IF NOT EXISTS "withdrawals" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "amount" decimal(15,2) NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "wallet_id" integer REFERENCES "withdrawal_wallets"("id"),
        "admin_note" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✅ Withdrawals table created");

    // Payment channels
    await client.query(`
      CREATE TABLE IF NOT EXISTS "payment_channels" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0
      )
    `);
    console.log("✅ Payment channels table created");

    // Payment numbers
    await client.query(`
      CREATE TABLE IF NOT EXISTS "payment_numbers" (
        "id" serial PRIMARY KEY,
        "operator_name" text NOT NULL,
        "phone" text NOT NULL,
        "owner_name" text NOT NULL,
        "country" text NOT NULL,
        "logo_url" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0
      )
    `);
    console.log("✅ Payment numbers table created");

    // Tasks
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "description" text,
        "reward" integer NOT NULL,
        "required_invites" integer NOT NULL DEFAULT 1,
        "is_active" boolean NOT NULL DEFAULT true
      )
    `);
    console.log("✅ Tasks table created");

    // User tasks
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_tasks" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "task_id" integer NOT NULL REFERENCES "tasks"("id"),
        "completed_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✅ User tasks table created");

    // Transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "type" text NOT NULL,
        "amount" decimal(15,2) NOT NULL,
        "description" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✅ Transactions table created");

    // Platform settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS "platform_settings" (
        "id" serial PRIMARY KEY,
        "key" text NOT NULL UNIQUE,
        "value" text NOT NULL
      )
    `);
    console.log("✅ Platform settings table created");

    // Referral commissions
    await client.query(`
      CREATE TABLE IF NOT EXISTS "referral_commissions" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "from_user_id" integer NOT NULL REFERENCES "users"("id"),
        "level" integer NOT NULL,
        "amount" decimal(15,2) NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✅ Referral commissions table created");

    // Staking products
    await client.query(`
      CREATE TABLE IF NOT EXISTS "staking_products" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "min_amount" integer NOT NULL,
        "max_amount" integer,
        "duration_days" integer NOT NULL,
        "interest_rate" decimal(5,2) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0
      )
    `);
    console.log("✅ Staking products table created");

    // User stakings
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_stakings" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id"),
        "staking_product_id" integer NOT NULL REFERENCES "staking_products"("id"),
        "amount" decimal(15,2) NOT NULL,
        "interest_earned" decimal(15,2) NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'active',
        "start_date" timestamp NOT NULL DEFAULT now(),
        "end_date" timestamp NOT NULL,
        "released_at" timestamp
      )
    `);
    console.log("✅ User stakings table created");

    // Admin audit log
    await client.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_log" (
        "id" serial PRIMARY KEY,
        "admin_id" integer NOT NULL REFERENCES "users"("id"),
        "action" text NOT NULL,
        "target_user_id" integer,
        "details" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✅ Admin audit log table created");

    // ── Seed countries ──
    const countriesData = [
      { code: "PH", name: "Philippines", currency: "PHP", phone_prefix: "63", operators: '["PayMaya","GCash"]' },
    ];
    for (const c of countriesData) {
      await client.query(
        `INSERT INTO countries (code, name, currency, phone_prefix, operators) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING`,
        [c.code, c.name, c.currency, c.phone_prefix, c.operators]
      );
    }
    console.log("✅ Countries inserted");

    // Administrator provisioning is intentionally not part of a data migration.
    // Create or update an administrator through the application seed flow with
    // ADMIN_PASSWORD supplied as a secret, never through embedded credentials.

    // ── Seed platform settings ──
    const settings = [
      ["minDeposit", "320"], ["minWithdrawal", "100"], ["withdrawalFees", "10"],
      ["withdrawalStartHour", "9"], ["withdrawalEndHour", "17"], ["maxWithdrawalsPerDay", "1"],
      ["level1Commission", "15"], ["level2Commission", "2"], ["level3Commission", "1"],
      ["signupBonus", "40"], ["soleaspayEnabled", "false"], ["soleaspayCountries", ""],
      ["soleaspayChannelName", "Westpay"], ["omnipayEnabled", "false"],
      ["omnipayChannelName", "OmniPay"], ["omnipayCallbackKey", ""],
       ["ashtechEnabled", "false"], ["ashtechChannelName", "AshtechPay"],
       ["ashtechCountries", ""], ["ashtechWebhookSecret", ""],
      ["supportLink", "https://t.me/intelappgroup"], ["supportType", "telegram"],
      ["supportLabel", "Customer service"], ["channelLink", "https://t.me/intelappgroup"],
      ["channelType", "telegram"], ["channelLabel", "Official channel"],
    ];
    for (const [key, value] of settings) {
      await client.query(
        `INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }
    console.log("✅ Platform settings inserted");

    // ── Seed products ──
    const productsData = [
      { name: "Free Bonus", price: 0, daily_earnings: 10, cycle_days: 100, total_return: 1000, is_free: true, sort_order: 0 },
      { name: "VIP 1", price: 320, daily_earnings: 64, cycle_days: 100, total_return: 6400, is_free: false, sort_order: 1 },
      { name: "VIP 2", price: 640, daily_earnings: 135, cycle_days: 100, total_return: 13500, is_free: false, sort_order: 2 },
      { name: "VIP 3", price: 1280, daily_earnings: 280, cycle_days: 100, total_return: 28000, is_free: false, sort_order: 3 },
      { name: "VIP 4", price: 2560, daily_earnings: 580, cycle_days: 100, total_return: 58000, is_free: false, sort_order: 4 },
      { name: "VIP 5", price: 5000, daily_earnings: 1190, cycle_days: 100, total_return: 119000, is_free: false, sort_order: 5 },
      { name: "VIP 6", price: 10000, daily_earnings: 2500, cycle_days: 100, total_return: 250000, is_free: false, sort_order: 6 },
    ];
    for (const p of productsData) {
      await client.query(
        `INSERT INTO products (name, price, daily_earnings, cycle_days, total_return, is_free, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [p.name, p.price, p.daily_earnings, p.cycle_days, p.total_return, p.is_free, p.sort_order]
      );
    }
    console.log("✅ Products inserted");

    // ── Seed tasks ──
    const tasksData = [
      { name: "Bronze referral", description: "Invite 3 people", reward: 1000, required_invites: 3 },
      { name: "Silver referral", description: "Invite 5 people", reward: 2000, required_invites: 5 },
      { name: "Gold referral", description: "Invite 10 people", reward: 5000, required_invites: 10 },
      { name: "Platinum referral", description: "Invite 20 people", reward: 10000, required_invites: 20 },
      { name: "Diamond referral", description: "Invite 50 people", reward: 25000, required_invites: 50 },
      { name: "Elite referral", description: "Invite 100 people", reward: 50000, required_invites: 100 },
    ];
    for (const t of tasksData) {
      await client.query(
        `INSERT INTO tasks (name, description, reward, required_invites) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [t.name, t.description, t.reward, t.required_invites]
      );
    }
    console.log("✅ Tasks inserted");

    console.log("\n🎉 Supabase migration completed successfully!");
    console.log("ℹ️ No administrator account is created by this script.");

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error("❌ Error:", e.message); process.exit(1); });
