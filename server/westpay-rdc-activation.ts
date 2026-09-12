import { sql } from "drizzle-orm";
import { db } from "./db";

const MIGRATION_KEY = "westpayRdcActivationVersion";
const MIGRATION_VERSION = "1";

/**
 * Enables the explicitly selected WestPay channel for the only supported
 * country. This is separate from the financial RDC/CDF migration so it never
 * reruns or changes historical amounts.
 */
export async function activateWestpayForRdc(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(48623110)`);

    const marker = await tx.execute(
      sql`SELECT value FROM platform_settings WHERE key = ${MIGRATION_KEY} LIMIT 1`,
    );
    if (marker.rows[0]?.value === MIGRATION_VERSION) return;

    await tx.execute(sql`
      INSERT INTO platform_settings (key, value)
      VALUES
        ('westpayEnabled', 'true'),
        ('westpayCountries', 'CD'),
        ('westpayChannelName', 'WestPay'),
        (${MIGRATION_KEY}, ${MIGRATION_VERSION})
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value
    `);
  });

  console.log("WestPay activated for RDC");
}