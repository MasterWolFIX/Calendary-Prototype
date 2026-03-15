'use strict';

const jwt = require('jsonwebtoken');

/**
 * middleware/authMiddleware.js
 * ────────────────────────────────────────────────────────────────────────────
 * Middleware weryfikujący Bearer Token (JWT) w nagłówku Authorization.
 *
 * Użycie w server.js:
 *   const authMiddleware = require('./middleware/authMiddleware');
 *   app.use('/api/events', authMiddleware, eventsRouter);
 *
 * Jeśli token jest prawidłowy, do req.user dołączany jest payload:
 *   { userId: number, email: string }
 * ────────────────────────────────────────────────────────────────────────────
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];

    // Oczekiwany format: "Bearer <token>"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Brak tokena autoryzacyjnego. Wymagany nagłówek: Authorization: Bearer <token>',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { userId, email, iat, exp }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token wygasł. Zaloguj się ponownie.' });
        }
        return res.status(401).json({ error: 'Nieprawidłowy token autoryzacyjny.' });
    }
}

module.exports = authMiddleware;
