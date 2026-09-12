import { sql } from "drizzle-orm";
import { db } from "./db";

const MIGRATION_KEY = "referralBonusDefaultsVersion";
const MIGRATION_VERSION = "1";

/**
 * Aligns the legacy RDC defaults with the current referral policy once.
 * Values already changed by an administrator are preserved.
 */
export async function migrateReferralBonusDefaults(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(48623111)`);

    const marker = await tx.execute(
      sql`SELECT value FROM platform_settings WHERE key = ${MIGRATION_KEY} LIMIT 1`,
    );
    if (marker.rows[0]?.value === MIGRATION_VERSION) return;

    await tx.execute(sql`
      UPDATE platform_settings
      SET value = CASE key
        WHEN 'level1Commission' THEN '20'
        WHEN 'level2Commission' THEN '5'
        WHEN 'level3Commission' THEN '2'
        ELSE value
      END
      WHERE key IN ('level1Commission', 'level2Commission', 'level3Commission')
        AND (
          SELECT COUNT(*)
          FROM platform_settings AS legacy_rates
          WHERE (legacy_rates.key = 'level1Commission' AND legacy_rates.value = '25')
             OR (legacy_rates.key = 'level2Commission' AND legacy_rates.value = '3')
             OR (legacy_rates.key = 'level3Commission' AND legacy_rates.value = '2')
        ) = 3
    `);

    await tx.execute(sql`
      INSERT INTO platform_settings (key, value)
      VALUES
        ('level1Commission', '20'),
        ('level2Commission', '5'),
        ('level3Commission', '2'),
        (${MIGRATION_KEY}, ${MIGRATION_VERSION})
      ON CONFLICT (key) DO NOTHING
    `);
  });

  console.log("Referral bonus defaults migrated");
}