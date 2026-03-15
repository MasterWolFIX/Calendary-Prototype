'use strict';

const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * routes/events.js
 * ────────────────────────────────────────────────────────────────────────────
 * Endpointy CRUD dla wydarzeń kalendarza.
 * Wszystkie trasy wymagają zalogowania (authMiddleware w server.js).
 *
 * req.user jest wstrzykiwany przez authMiddleware i zawiera:
 *   { userId: number, email: string }
 *
 * Endpointy:
 *   GET    /api/events           – Lista wydarzeń zalogowanego użytkownika
 *   POST   /api/events           – Utwórz nowe wydarzenie
 *   PUT    /api/events/:id       – Edytuj istniejące wydarzenie
 *   DELETE /api/events/:id       – Usuń wydarzenie
 * ────────────────────────────────────────────────────────────────────────────
 */

// ── GET /api/events ──────────────────────────────────────────────────────────
/**
 * Pobiera wszystkie wydarzenia zalogowanego użytkownika.
 *
 * Query params (opcjonalne – filtry po dacie):
 *   ?from=2025-01-01   – zdarzenia od tej daty (włącznie)
 *   ?to=2025-01-31     – zdarzenia do tej daty (włącznie)
 *
 * Odpowiedź 200:
 *   { events: [ { id, title, description, start_date, end_date, notified } ] }
 */
router.get('/', async (req, res) => {
    const { from, to } = req.query;
    const userId = req.user.userId;

    try {
        let query = `
      SELECT id, title, description, start_date, end_date, notified, color
      FROM   events
      WHERE  user_id = $1
    `;
        const params = [userId];

        if (from) {
            params.push(from);
            query += ` AND start_date >= $${params.length}`;
        }

        if (to) {
            params.push(to);
            query += ` AND end_date <= $${params.length}`;
        }

        query += ' ORDER BY start_date ASC';

        const result = await pool.query(query, params);

        return res.status(200).json({ events: result.rows });
    } catch (err) {
        console.error('[GET /api/events] Błąd:', err.message);
        return res.status(500).json({ error: 'Błąd serwera podczas pobierania wydarzeń.' });
    }
});

// ── POST /api/events ─────────────────────────────────────────────────────────
/**
 * Tworzy nowe wydarzenie dla zalogowanego użytkownika.
 *
 * Body (JSON):
 *   {
 *     "title":       "Spotkanie z klientem",
 *     "description": "Omówienie projektu",   // opcjonalnie
 *     "start_date":  "2025-06-15T10:00:00",
 *     "end_date":    "2025-06-15T11:00:00"
 *   }
 *
 * Odpowiedź 201: { event: { id, title, description, start_date, end_date, notified } }
 */
router.post('/', async (req, res) => {
    const { title, description, start_date, end_date, color } = req.body ?? {};
    const userId = req.user.userId;

    // ── Walidacja ──────────────────────────────────────────────────────────────
    if (!title || !start_date) {
        return res.status(400).json({
            error: 'Pola title i start_date są wymagane.',
        });
    }

    if (end_date && new Date(start_date) > new Date(end_date)) {
        return res.status(400).json({
            error: 'start_date musi być wcześniejsza niż end_date.',
        });
    }

    try {
        const result = await pool.query(
            `INSERT INTO events (user_id, title, description, start_date, end_date, color)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, start_date, end_date, notified, color`,
            [userId, title, description ?? null, start_date, end_date ?? null, color ?? null]
        );

        return res.status(201).json({ event: result.rows[0] });
    } catch (err) {
        console.error('[POST /api/events] Błąd:', err.message);
        return res.status(500).json({ error: 'Błąd serwera podczas tworzenia wydarzenia.' });
    }
});

// ── PUT /api/events/:id ──────────────────────────────────────────────────────
/**
 * Aktualizuje istniejące wydarzenie.
 * Dozwolona jest aktualizacja częściowa (tylko podane pola zostają zmienione).
 *
 * Body (JSON) – wszystkie pola opcjonalne:
 *   {
 *     "title":       "Nowy tytuł",
 *     "description": "Nowy opis",
 *     "start_date":  "2025-06-15T12:00:00",
 *     "end_date":    "2025-06-15T13:00:00"
 *   }
 *
 * Odpowiedź 200: { event: { id, title, description, start_date, end_date, notified } }
 */
router.put('/:id', async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    const userId = req.user.userId;
    const { title, description, start_date, end_date, color } = req.body ?? {};

    if (isNaN(eventId)) {
        return res.status(400).json({ error: 'Nieprawidłowe ID wydarzenia.' });
    }

    try {
        // Sprawdź, czy wydarzenie należy do zalogowanego użytkownika
        const existing = await pool.query(
            'SELECT id FROM events WHERE id = $1 AND user_id = $2',
            [eventId, userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                error: 'Wydarzenie nie istnieje lub nie masz do niego dostępu.',
            });
        }

        // Budujemy zapytanie UPDATE dynamicznie (aktualizujemy tylko podane pola)
        const fields = [];
        const params = [];

        if (title !== undefined) { params.push(title); fields.push(`title = $${params.length}`); }
        if (description !== undefined) { params.push(description); fields.push(`description = $${params.length}`); }
        if (start_date !== undefined) { params.push(start_date); fields.push(`start_date = $${params.length}`); }
        if (end_date !== undefined) { params.push(end_date); fields.push(`end_date = $${params.length}`); }
        if (color !== undefined) { params.push(color); fields.push(`color = $${params.length}`); }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'Nie podano żadnych pól do aktualizacji.' });
        }

        // Przy zmianie daty resetujemy flagę notified, żeby cron mógł ponownie wysłać powiadomienie
        if (start_date !== undefined || end_date !== undefined) {
            fields.push(`notified = FALSE`);
        }

        params.push(eventId);
        const query = `
      UPDATE events
      SET    ${fields.join(', ')}
      WHERE  id = $${params.length}
      RETURNING id, title, description, start_date, end_date, notified, color
    `;

        const result = await pool.query(query, params);

        return res.status(200).json({ event: result.rows[0] });
    } catch (err) {
        console.error('[PUT /api/events/:id] Błąd:', err.message);
        return res.status(500).json({ error: 'Błąd serwera podczas aktualizacji wydarzenia.' });
    }
});

// ── DELETE /api/events/:id ───────────────────────────────────────────────────
/**
 * Usuwa wydarzenie. Dozwolone tylko przez właściciela.
 *
 * Odpowiedź 200: { message: "Wydarzenie zostało usunięte." }
 */
router.delete('/:id', async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    const userId = req.user.userId;

    if (isNaN(eventId)) {
        return res.status(400).json({ error: 'Nieprawidłowe ID wydarzenia.' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM events WHERE id = $1 AND user_id = $2 RETURNING id',
            [eventId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Wydarzenie nie istnieje lub nie masz do niego dostępu.',
            });
        }

        return res.status(200).json({ message: 'Wydarzenie zostało usunięte.' });
    } catch (err) {
        console.error('[DELETE /api/events/:id] Błąd:', err.message);
        return res.status(500).json({ error: 'Błąd serwera podczas usuwania wydarzenia.' });
    }
});

module.exports = router;
