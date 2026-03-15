'use strict';

const { Pool } = require('pg');

/**
 * Współdzielone połączenie z PostgreSQL.
 * Importuj ten moduł wszędzie tam, gdzie potrzebujesz dostępu do bazy.
 *
 * Zmienna środowiskowa: DATABASE_URL (connection string)
 * Przykład: postgres://user:password@localhost:5432/calendary
 */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // ssl: { rejectUnauthorized: false }, // odkomentuj dla Supabase / Cloudflare Tunnel
});

pool.on('connect', () => {
    console.log('[DB] Nowe połączenie z PostgreSQL nawiązane.');
});

pool.on('error', (err) => {
    console.error('[DB] Nieoczekiwany błąd puli połączeń:', err.message);
});

module.exports = pool;
