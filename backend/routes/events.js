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
      SELECT id, title, description, start_date, end_date, notified, color, recurrence, excluded_dates
      FROM   events
      WHERE  user_id = $1
    `;
        const params = [userId];

        // Pobieramy wszystkie wydarzenia użytkownika, a potem filtrujemy/powielamy je w pamięci
        // (W większych systemach filtrowanie byłoby w DB, ale dla cykliczności JS jest wygodniejszy)
        const result = await pool.query(query, params);

        const dateFrom = from ? new Date(from) : new Date(2000, 0, 1);
        const dateTo = to ? new Date(to) : new Date(2100, 0, 1);

        const allEvents = [];

        result.rows.forEach(ev => {
            const start = new Date(ev.start_date);
            const duration = ev.end_date ? (new Date(ev.end_date) - start) : 0;

            if (!ev.recurrence || ev.recurrence === 'none') {
                if (start <= dateTo && start >= dateFrom) {
                    allEvents.push(ev);
                }
                return;
            }

            // Logika powielania (Daily, Weekly, Monthly)
            let curr = new Date(start);
            // Przeskocz do początku zakresu, aby nie pętlić się od 1900 roku
            while (curr < dateFrom) {
                if (ev.recurrence === 'daily') curr.setDate(curr.getDate() + 1);
                else if (ev.recurrence === 'weekly') curr.setDate(curr.getDate() + 7);
                else if (ev.recurrence === 'monthly') curr.setMonth(curr.getMonth() + 1);
                else break;
            }

            // Generuj wystąpienia w zakresie
            const startMonth = start.getMonth();
            const exclusions = Array.isArray(ev.excluded_dates) ? ev.excluded_dates : [];

            while (curr <= dateTo) {
                // Limit: co tydzień tylko do końca miesiąca
                if (ev.recurrence === 'weekly' && curr.getMonth() !== startMonth) break;

                const newStart = new Date(curr);
                // Kompensacja strefy czasowej dla porównania z wykluczeniami (PL: +1h/+2h)
                const localDateAdjusted = new Date(newStart.getTime() + 2 * 60 * 60000);
                const isoStart = localDateAdjusted.toISOString().split('T')[0];

                // Pomiń jeśli data jest na liście wykluczonych
                if (!exclusions.includes(isoStart)) {
                    const newEnd = ev.end_date ? new Date(newStart.getTime() + duration) : null;

                    allEvents.push({
                        ...ev,
                        id: `${ev.id}_${newStart.getTime()}`, // Unikalne ID dla frontu
                        original_id: ev.id,
                        is_recurring: true,
                        start_date: newStart.toISOString(),
                        end_date: newEnd ? newEnd.toISOString() : null
                    });
                }

                if (ev.recurrence === 'daily') curr.setDate(curr.getDate() + 1);
                else if (ev.recurrence === 'weekly') curr.setDate(curr.getDate() + 7);
                else if (ev.recurrence === 'monthly') curr.setMonth(curr.getMonth() + 1);
                else break;
            }
        });

        allEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        return res.status(200).json({ events: allEvents });
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
    const { title, description, start_date, end_date, color, recurrence } = req.body ?? {};
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
            `INSERT INTO events (user_id, title, description, start_date, end_date, color, recurrence, excluded_dates)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, description, start_date, end_date, notified, color, recurrence, excluded_dates`,
            [userId, title, description ?? null, start_date, end_date ?? null, color ?? null, recurrence ?? 'none', '[]']
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
    const { title, description, start_date, end_date, color, recurrence } = req.body ?? {};

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
        if (recurrence !== undefined) { params.push(recurrence); fields.push(`recurrence = $${params.length}`); }
        if (req.body.excluded_dates !== undefined) { params.push(JSON.stringify(req.body.excluded_dates)); fields.push(`excluded_dates = $${params.length}`); }

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
      RETURNING id, title, description, start_date, end_date, notified, color, recurrence, excluded_dates
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

// ── POST /api/events/:id/exclude ──────────────────────────────────────────
/**
 * Dodaje konkretną datę do listy wykluczeń wydarzenia cyklicznego.
 */
router.post('/:id/exclude', async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    const userId = req.user.userId;
    const { date } = req.body; // format 'YYYY-MM-DD'

    if (!date) return res.status(400).json({ error: 'Data jest wymagana.' });

    try {
        const existing = await pool.query(
            'SELECT excluded_dates FROM events WHERE id = $1 AND user_id = $2',
            [eventId, userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Wydarzenie nie istnieje.' });
        }

        const currentExclusions = Array.isArray(existing.rows[0].excluded_dates)
            ? existing.rows[0].excluded_dates
            : [];

        if (!currentExclusions.includes(date)) {
            currentExclusions.push(date);
        }

        await pool.query(
            'UPDATE events SET excluded_dates = $1 WHERE id = $2',
            [JSON.stringify(currentExclusions), eventId]
        );

        return res.status(200).json({ message: 'Data została wykluczona.' });
    } catch (err) {
        console.error('[POST /exclude] Błąd:', err.message);
        return res.status(500).json({ error: 'Błąd serwera.' });
    }
});

module.exports = router;
