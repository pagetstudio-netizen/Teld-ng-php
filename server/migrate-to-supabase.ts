import pg from "pg";

const { Pool } = pg;

const SOURCE_URL = process.env.DATABASE_URL;
const DEST_URL = process.env.SUPABASE_DATABASE_URL;

if (!SOURCE_URL || !DEST_URL) {
  console.error("DATABASE_URL and SUPABASE_DATABASE_URL must be set");
  process.exit(1);
}

const sourcePool = new Pool({ connectionString: SOURCE_URL });
const destPool = new Pool({ connectionString: DEST_URL });

async function migrateTable(tableName: string) {
  console.log(`Migrating ${tableName}...`);
  
  try {
    const sourceResult = await sourcePool.query(`SELECT * FROM ${tableName}`);
    const rows = sourceResult.rows;
    
    if (rows.length === 0) {
      console.log(`  ${tableName}: 0 rows (skipped)`);
      return;
    }

    // The first migration pass may have already populated dependent tables.
    // Cascade only affects the Supabase destination, which is being replaced
    // by the source snapshot during this explicit migration.
    await destPool.query(`TRUNCATE TABLE "${tableName}" CASCADE`);

    const columns = Object.keys(rows[0]);
    let migrated = 0;
    
    for (const row of rows) {
      const values = columns.map(col => row[col]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const columnNames = columns.map(c => `"${c}"`).join(', ');
      
      try {
        await destPool.query(
          `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
        migrated++;
      } catch (e: any) {
        console.log(`  Error inserting row: ${e.message}`);
      }
    }

    if (columns.includes('id')) {
      try {
        await destPool.query(
          `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 1), true)`
        );
      } catch (e) {
      }
    }
    
    console.log(`  ${tableName}: ${migrated}/${rows.length} rows migrated`);
  } catch (err: any) {
    console.log(`  ${tableName}: ERROR - ${err.message}`);
  }
}

async function migrate() {
  console.log("Starting migration from Replit Production to Supabase...\n");

  // The session table is created by the application seed on a fresh runtime,
  // but it is not part of shared/schema.ts. Create it here so sessions can be
  // copied as well when the app is moved to Supabase.
  await destPool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL PRIMARY KEY,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);
  
  const tables = [
    'countries',
    'users',
    'products',
    'user_products',
    'staking_products',
    'user_stakings',
    'deposits',
    'withdrawals',
    'withdrawal_wallets',
    'payment_channels',
    'payment_numbers',
    'tasks',
    'user_tasks',
    'transactions',
    'referral_commissions',
    'platform_settings',
    'admin_audit_log',
    'gift_codes',
    'gift_code_claims',
    'session'
  ];
  
  for (const table of tables) {
    await migrateTable(table);
  }
  
  console.log("\nMigration completed!");
  
  const userCount = await destPool.query("SELECT COUNT(*) FROM users");
  const depositCount = await destPool.query("SELECT COUNT(*) FROM deposits");
  const transactionCount = await destPool.query("SELECT COUNT(*) FROM transactions");
  
  console.log(`\nVerification:`);
  console.log(`  Users: ${userCount.rows[0].count}`);
  console.log(`  Deposits: ${depositCount.rows[0].count}`);
  console.log(`  Transactions: ${transactionCount.rows[0].count}`);
  
  await sourcePool.end();
  await destPool.end();
}

migrate().catch(console.error);
