import { sql } from "drizzle-orm";
import { db } from "./db";

const MIGRATION_KEY = "rdcCdfMigrationVersion";
const MIGRATION_VERSION = "1";
const RATE = "4.08";
const RDC_OPERATORS = JSON.stringify(["Orange Money RDC", "Airtel Money RDC"]);

/**
 * Converts the existing single-currency installation to the RDC/CDF model.
 * The migration marker is written in the same transaction as the conversion,
 * so restarts cannot multiply financial values a second time.
 */
export async function migrateToRdcCdf(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(48623109)`);

    const marker = await tx.execute(
      sql`SELECT value FROM platform_settings WHERE key = ${MIGRATION_KEY} LIMIT 1`,
    );
    if (marker.rows[0]?.value === MIGRATION_VERSION) {
      return;
    }

    await tx.execute(sql`
      INSERT INTO countries (code, name, currency, phone_prefix, operators, is_active)
      VALUES ('CD', 'Democratic Republic of the Congo', 'CDF', '243', ${RDC_OPERATORS}, true)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          currency = EXCLUDED.currency,
          phone_prefix = EXCLUDED.phone_prefix,
          operators = EXCLUDED.operators,
          is_active = true
    `);

    await tx.execute(sql`UPDATE users SET country = 'CD'`);
    await tx.execute(sql`UPDATE withdrawal_wallets SET country = 'CD'`);
    await tx.execute(sql`UPDATE deposits SET country = 'CD'`);
    await tx.execute(sql`UPDATE withdrawals SET country = 'CD'`);
    await tx.execute(sql`UPDATE payment_numbers SET country = 'CD', is_active = false WHERE operator_name NOT IN ('Orange Money RDC', 'Airtel Money RDC')`);
    await tx.execute(sql`UPDATE payment_numbers SET country = 'CD' WHERE operator_name IN ('Orange Money RDC', 'Airtel Money RDC')`);

    await tx.execute(sql`UPDATE users SET balance = ROUND(balance * (${RATE}::numeric), 2), today_earnings = ROUND(today_earnings * (${RATE}::numeric), 2), total_earnings = ROUND(total_earnings * (${RATE}::numeric), 2)`);
    await tx.execute(sql`UPDATE products SET price = ROUND(price * (${RATE}::numeric))::integer, daily_earnings = ROUND(daily_earnings * (${RATE}::numeric))::integer, total_return = ROUND(total_return * (${RATE}::numeric))::integer`);
    await tx.execute(sql`UPDATE user_products SET total_earned = ROUND(total_earned * (${RATE}::numeric), 2)`);
    await tx.execute(sql`UPDATE deposits SET amount = ROUND(amount * (${RATE}::numeric))::integer`);
    await tx.execute(sql`UPDATE withdrawals SET amount = ROUND(amount * (${RATE}::numeric))::integer, net_amount = ROUND(net_amount * (${RATE}::numeric))::integer, fees = ROUND(fees * (${RATE}::numeric))::integer`);
    await tx.execute(sql`UPDATE staking_products SET price = ROUND(price * (${RATE}::numeric))::integer, return_amount = ROUND(return_amount * (${RATE}::numeric))::integer`);
    await tx.execute(sql`UPDATE user_stakings SET amount_paid = ROUND(amount_paid * (${RATE}::numeric))::integer, return_amount = ROUND(return_amount * (${RATE}::numeric))::integer`);
    await tx.execute(sql`UPDATE referral_commissions SET amount = ROUND(amount * (${RATE}::numeric), 2)`);
    await tx.execute(sql`UPDATE tasks SET reward = ROUND(reward * (${RATE}::numeric))::integer`);
    await tx.execute(sql`UPDATE transactions SET amount = ROUND(amount * (${RATE}::numeric), 2)`);
    await tx.execute(sql`UPDATE gift_codes SET amount = ROUND(amount * (${RATE}::numeric), 2)`);

    await tx.execute(sql`
      UPDATE platform_settings
      SET value = CASE key
        WHEN 'signupBonus' THEN '40'
        WHEN 'minDeposit' THEN '320'
        WHEN 'minWithdrawal' THEN '100'
        WHEN 'soleaspayEnabled' THEN 'false'
        WHEN 'sendavapayEnabled' THEN 'false'
        WHEN 'westpayEnabled' THEN 'false'
        WHEN 'ashtechEnabled' THEN 'false'
        WHEN 'soleaspayCountries' THEN ''
        WHEN 'westpayCountries' THEN ''
        WHEN 'ashtechCountries' THEN ''
        ELSE value
      END
      WHERE key IN (
        'signupBonus', 'minDeposit', 'minWithdrawal',
        'soleaspayEnabled', 'sendavapayEnabled', 'westpayEnabled', 'ashtechEnabled',
        'soleaspayCountries', 'westpayCountries', 'ashtechCountries'
      )
    `);

    await tx.execute(sql`
      INSERT INTO platform_settings (key, value)
      VALUES
        ('signupBonus', '40'),
        ('minDeposit', '320'),
        ('minWithdrawal', '100'),
        ('soleaspayEnabled', 'false'),
        ('sendavapayEnabled', 'false'),
        ('westpayEnabled', 'false'),
        ('ashtechEnabled', 'false'),
        (${MIGRATION_KEY}, ${MIGRATION_VERSION})
      ON CONFLICT (key) DO NOTHING
    `);

    await tx.execute(sql`DELETE FROM countries WHERE code <> 'CD'`);
  });

  console.log("RDC/CDF migration complete");
}