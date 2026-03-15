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
    process.exit(0);
}
migrate();
