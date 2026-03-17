-- ============================================================
-- Calendary – Inicjalizacja schematu bazy danych PostgreSQL
-- Uruchom ten plik jednorazowo przed pierwszym startem serwera:
--   psql -U <user> -d <dbname> -f schema.sql
-- ============================================================

-- Tabela użytkowników
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    fcm_token     TEXT,                                      -- token FCM do powiadomień push (Android)
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indeks na email (szybsze wyszukiwanie przy logowaniu)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Tabela wydarzeń kalendarza
CREATE TABLE IF NOT EXISTS events (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    start_date  TIMESTAMPTZ NOT NULL,
    end_date    TIMESTAMPTZ,
    notified    BOOLEAN DEFAULT FALSE,                       -- czy powiadomienie push zostało wysłane
    color       VARCHAR(50),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indeks na user_id + start_date (szybsze filtrowanie wydarzeń użytkownika po dacie)
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events (user_id, start_date);

-- Indeks dla cron jobu (szybkie wyszukiwanie nienotyfikowanych wydarzeń)
CREATE INDEX IF NOT EXISTS idx_events_notified ON events (notified, start_date)
    WHERE notified = FALSE;
