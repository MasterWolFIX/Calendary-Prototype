require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    try {
        await pool.query('ALTER TABLE events ADD COLUMN color VARCHAR(50);');
        console.log('Added color column');
    } catch (e) { console.log(e.message); }
    
    try {
        await pool.query('ALTER TABLE events ALTER COLUMN end_date DROP NOT NULL;');
        console.log('Made end_date optional');
    } catch (e) { console.log(e.message); }

    try {
        await pool.query(`
            ALTER TABLE events ALTER COLUMN start_date TYPE TIMESTAMPTZ USING start_date AT TIME ZONE 'UTC';
            ALTER TABLE events ALTER COLUMN end_date TYPE TIMESTAMPTZ USING end_date AT TIME ZONE 'UTC';
        `);
        console.log('Changed timestamps to TIMESTAMPTZ (with timezone)');
    } catch (e) { console.log(e.message); }

    process.exit(0);
}
migrate();
