/**
 * routes/auth.js
 * ────────────────────────────────────────────────────────────────────────────
 * Moduł autentykacji zgodny ze SPECYFIKACJĄ PROJEKTU CALENDARY (monorepo).
 *
 * Endpointy:
 *   POST /api/auth/register  –  Rejestracja nowego użytkownika
 *   POST /api/auth/login     –  Logowanie istniejącego użytkownika
 *
 * Zależności (npm):
 *   express, bcrypt, jsonwebtoken, pg
 *
 * Zmienne środowiskowe (.env):
 *   DATABASE_URL  –  connection string PostgreSQL
 *   JWT_SECRET    –  klucz do podpisywania tokenów JWT
 * ────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ── Połączenie z PostgreSQL ──────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // ssl: { rejectUnauthorized: false }, // odkomentuj przy połączeniu przez Cloudflare/Supabase
});

// Testowe sprawdzenie połączenia przy starcie serwera
pool.connect()
    .then(client => {
        console.log('[DB] Połączono z PostgreSQL.');
        client.release();
    })
    .catch(err => console.error('[DB] Błąd połączenia z PostgreSQL:', err.message));

// ── Stałe konfiguracyjne ─────────────────────────────────────────────────────
const SALT_ROUNDS = 10;          // bcrypt – standardowe 10 rund (bezpieczne, ~4x szybsze niż 12)
const JWT_EXPIRES = '7d';        // ważność tokenu Bearer

// ── Helpery ──────────────────────────────────────────────────────────────────

/**
 * Walidacja prostego formatu adresu e-mail.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Generuje podpisany token JWT dla danego użytkownika.
 * @param {{ id: number, email: string }} user
 * @returns {string}
 */
function generateToken(user) {
    return jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );
}

// ── POST /api/auth/register ──────────────────────────────────────────────────
/**
 * Rejestracja nowego użytkownika.
 *
 * Body (JSON):
 *   {
 *     "email":    "user@example.com",
 *     "password": "min8znaków"
 *   }
 *
 * Odpowiedzi:
 *   201 – rejestracja OK, zwraca token JWT i dane użytkownika
 *   400 – brakujące / nieprawidłowe dane wejściowe
 *   409 – e-mail już zajęty
 *   500 – błąd serwera
 */
router.post('/register', async (req, res) => {
    const { email, password } = req.body ?? {};

    // ── 1. Walidacja danych wejściowych ────────────────────────────────────────
    if (!email || !password) {
        return res.status(400).json({
            error: 'Pola email i password są wymagane.',
        });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({
            error: 'Podany adres e-mail jest nieprawidłowy.',
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            error: 'Hasło musi mieć co najmniej 8 znaków.',
        });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();

        // ── 2. Sprawdzenie unikalności e-maila ──────────────────────────────────
        const existing = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [normalizedEmail]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'Użytkownik z tym adresem e-mail już istnieje.',
            });
        }

        // ── 3. Szyfrowanie hasła bcrypt ─────────────────────────────────────────
        //    Hasło jest solone i hashowane zgodnie z wymaganiem bezpieczeństwa.
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // ── 4. Zapis w bazie danych ─────────────────────────────────────────────
        //    Schema: users(id, email, password_hash, fcm_token, created_at)
        const result = await pool.query(
            `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
            [normalizedEmail, passwordHash]
        );

        const newUser = result.rows[0];

        // ── 5. Generowanie tokena JWT (Bearer) ──────────────────────────────────
        const token = generateToken(newUser);

        return res.status(201).json({
            message: 'Rejestracja zakończona sukcesem.',
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                createdAt: newUser.created_at,
            },
        });

    } catch (err) {
        console.error('[POST /api/auth/register] Błąd:', err.message);
        return res.status(500).json({
            error: 'Wewnętrzny błąd serwera. Spróbuj ponownie później.',
        });
    }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
/**
 * Logowanie istniejącego użytkownika.
 *
 * Body (JSON):
 *   {
 *     "email":    "user@example.com",
 *     "password": "twoje_haslo"
 *   }
 *
 * Odpowiedzi:
 *   200 – logowanie OK, zwraca token JWT i dane użytkownika
 *   400 – brakujące dane wejściowe
 *   401 – nieprawidłowe dane logowania
 *   500 – błąd serwera
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};

    // ── 1. Walidacja danych wejściowych ────────────────────────────────────────
    if (!email || !password) {
        return res.status(400).json({
            error: 'Pola email i password są wymagane.',
        });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();

        // ── 2. Pobranie użytkownika z bazy ──────────────────────────────────────
        const result = await pool.query(
            'SELECT id, email, password_hash FROM users WHERE email = $1',
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            // Ogólny komunikat – nie ujawniamy, czy e-mail istnieje (security)
            return res.status(401).json({
                error: 'Nieprawidłowy e-mail lub hasło.',
            });
        }

        const user = result.rows[0];

        // ── 3. Weryfikacja hasła ─────────────────────────────────────────────────
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Nieprawidłowy e-mail lub hasło.',
            });
        }

        // ── 4. Generowanie tokena JWT (Bearer) ──────────────────────────────────
        const token = generateToken(user);

        return res.status(200).json({
            message: 'Zalogowano pomyślnie.',
            token,
            user: {
                id: user.id,
                email: user.email,
            },
        });

    } catch (err) {
        console.error('[POST /api/auth/login] Błąd:', err.message);
        return res.status(500).json({
            error: 'Wewnętrzny błąd serwera. Spróbuj ponownie później.',
        });
    }
});

// ── POST /api/auth/fcm-token ──────────────────────────────────────────────────
router.post('/fcm-token', authMiddleware, async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token jest wymagany.' });
    }

    try {
        await pool.query(
            'UPDATE users SET fcm_token = $1 WHERE id = $2',
            [token, req.user.userId]
        );
        return res.status(200).json({ message: 'Token zapisany poprawnie.' });
    } catch (err) {
        console.error('[POST /api/auth/fcm-token] Błąd:', err.message);
        return res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
});

module.exports = router;
