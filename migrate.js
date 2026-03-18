require('dotenv').config({ path: './backend/.env' });
const pool = require('./backend/db');
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
        await pool.query("ALTER TABLE events ADD COLUMN recurrence VARCHAR(20) DEFAULT 'none';");
        console.log('Added recurrence column');
    } catch (e) { console.log(e.message); }
    try {
        await pool.query("ALTER TABLE events ADD COLUMN excluded_dates JSONB DEFAULT '[]';");
        console.log('Added excluded_dates column');
    } catch (e) { console.log(e.message); }
    process.exit(0);
}
migrate();
