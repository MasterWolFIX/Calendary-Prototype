'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');

// ── Importy modułów projektu ─────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const authMiddleware = require('./middleware/authMiddleware');
const { initNotificationService } = require('./services/notificationService');

// ── Konfiguracja aplikacji ───────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware globalne ──────────────────────────────────────────────────────
app.use(cors());                       // Zezwalaj na żądania z frontendu React i aplikacji mobilnej
app.use(express.json());               // Parsowanie ciała żądania jako JSON
app.use(express.urlencoded({ extended: true }));

// ── Informacje o żądaniach (prosty logger) ───────────────────────────────────
app.use((req, _res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
});

// ── Trasy publiczne (bez JWT) ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── Trasy chronione (wymagają Bearer Token) ──────────────────────────────────
app.use('/api/events', authMiddleware, eventsRoutes);

// ── Endpoint health-check ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Calendary API',
    });
});

// ── Obsługa nieznanych tras ──────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint nie istnieje.' });
});

// ── Globalny handler błędów ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[SERVER] Nieobsłużony błąd:', err.message);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera.' });
});

// ── Start serwera ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Calendary API uruchomione na porcie ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health\n`);

    // Uruchom silnik powiadomień (cron + Firebase)
    // Komentarz: zainicjuj DOPIERO po starcie serwera, żeby pula DB była gotowa
    initNotificationService();
});

module.exports = app; // eksport dla testów jednostkowych
