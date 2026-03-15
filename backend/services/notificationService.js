'use strict';

const cron = require('node-cron');
const admin = require('firebase-admin');
const pool = require('../db');

/**
 * services/notificationService.js
 * ────────────────────────────────────────────────────────────────────────────
 * Silnik powiadomień push (Firebase Cloud Messaging).
 *
 * Uruchamia zadanie cron co 15 minut, które:
 *   1. Pobiera z bazy wszystkie wydarzenia zaplanowane w ciągu najbliższych 24h
 *      i z flagą notified = false.
 *   2. Pobiera fcm_token właściciela każdego takiego wydarzenia.
 *   3. Wysyła powiadomienie push przez Firebase Cloud Messaging.
 *   4. Ustawia notified = true, żeby nie wysyłać duplikatów.
 *
 * Zmienna środowiskowa:
 *   FIREBASE_ADMIN_SDK_JSON – ścieżka lub zawartość JSON Service Account
 *
 * Inicjalizacja Firebase:
 *   Moduł inicjalizuje Firebase Admin SDK przy pierwszym imporcie.
 *   Wywołaj initNotificationService() w server.js po starcie Express.
 * ────────────────────────────────────────────────────────────────────────────
 */

let firebaseInitialized = false;

/**
 * Inicjalizuje Firebase Admin SDK.
 * Bezpieczne do wielokrotnego wywołania (idempotentne).
 */
function initFirebase() {
    if (firebaseInitialized || admin.apps.length > 0) return;

    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        firebaseInitialized = true;
        console.log('[FCM] Firebase Admin SDK zainicjalizowany.');
    } catch (err) {
        console.error('[FCM] Błąd inicjalizacji Firebase Admin SDK:', err.message);
        console.error('[FCM] Sprawdź zmienną środowiskową FIREBASE_ADMIN_SDK_JSON.');
    }
}

/**
 * Główna funkcja silnika powiadomień.
 * Sprawdza bazę i wysyła powiadomienia push dla nadchodzących wydarzeń.
 */
async function sendPendingNotifications() {
    console.log('[CRON] Sprawdzam nadchodzące wydarzenia...');

    try {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Pobierz wydarzenia z flagą notified = false, zaplanowane w ciągu 24h
        const result = await pool.query(
            `SELECT
         e.id          AS event_id,
         e.title,
         e.start_date,
         u.fcm_token
       FROM   events e
       JOIN   users  u ON u.id = e.user_id
       WHERE  e.notified   = FALSE
         AND  e.start_date >= $1
         AND  e.start_date <= $2
         AND  u.fcm_token  IS NOT NULL`,
            [now.toISOString(), in24h.toISOString()]
        );

        if (result.rows.length === 0) {
            console.log('[CRON] Brak oczekujących powiadomień.');
            return;
        }

        console.log(`[CRON] Znaleziono ${result.rows.length} wydarzeń do powiadomienia.`);

        for (const row of result.rows) {
            const startDate = new Date(row.start_date);
            const timeStr = startDate.toLocaleTimeString('pl-PL', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Warsaw',
            });

            // Treść powiadomienia push
            const message = {
                token: row.fcm_token,
                notification: {
                    title: '📅 Nadchodzące wydarzenie',
                    body: `Masz jutro wydarzenie: "${row.title}" o godzinie ${timeStr}`,
                },
                data: {
                    event_id: String(row.event_id),
                    start_date: row.start_date.toISOString(),
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'calendary_reminders',
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    },
                },
            };

            try {
                const response = await admin.messaging().send(message);
                console.log(`[FCM] Wysłano powiadomienie dla wydarzenia #${row.event_id}. FCM ID: ${response}`);

                // Oznacz wydarzenie jako powiadomione
                await pool.query(
                    'UPDATE events SET notified = TRUE WHERE id = $1',
                    [row.event_id]
                );
            } catch (fcmErr) {
                console.error(`[FCM] Błąd wysyłania dla wydarzenia #${row.event_id}:`, fcmErr.message);
                // Nie przerywamy pętli – przechodzimy do kolejnego wydarzenia
            }
        }
    } catch (err) {
        console.error('[CRON] Błąd podczas sprawdzania powiadomień:', err.message);
    }
}

function initNotificationService() {
    initFirebase();

    // Uruchom raz natychmiast przy starcie (opcjonalne – przydatne przy restarcie serwera)
    sendPendingNotifications();

    // Zaplanuj cykliczne sprawdzanie co 15 minut
    cron.schedule('*/15 * * * *', () => {
        sendPendingNotifications();
    });

    console.log('[CRON] Silnik powiadomień uruchomiony (co 15 minut).');
}

module.exports = { initNotificationService };
