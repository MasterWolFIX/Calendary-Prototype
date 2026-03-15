'use strict';

const cron = require('node-cron');
const { Expo } = require('expo-server-sdk');
const pool = require('../db');

/**
 * services/notificationService.js
 * ────────────────────────────────────────────────────────────────────────────
 * Silnik powiadomień push (Expo Push Notifications + Cron)
 */

let expo = new Expo();

/**
 * Główna funkcja silnika powiadomień.
 * Sprawdza bazę i wysyła powiadomienia push przez infrastrukturę Expo.
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

        let messages = [];
        let eventIdsToUpdate = [];

        for (const row of result.rows) {
            if (!Expo.isExpoPushToken(row.fcm_token)) {
                console.error(`[CRON] Token ${row.fcm_token} nie jest poprawnym tokenem Expo! Pomijam.`);
                continue;
            }

            const startDate = new Date(row.start_date);
            const timeStr = startDate.toLocaleTimeString('pl-PL', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw',
            });

            messages.push({
                to: row.fcm_token,
                sound: 'default',
                title: '📅 Nadchodzące wydarzenie',
                body: `Masz jutro wydarzenie: "${row.title}" o godzinie ${timeStr}`,
                data: { event_id: String(row.event_id) },
                channelId: 'calendary_reminders', // potrzebne na Androidzie
            });
            eventIdsToUpdate.push(row.event_id);
        }

        // Wysyłanie paczkami po max 100 sztuk (limit Expo)
        let chunks = expo.chunkPushNotifications(messages);

        for (let chunk of chunks) {
            try {
                let receipts = await expo.sendPushNotificationsAsync(chunk);
                console.log('[FCM] Wysłano paczkę powiadomień Expo:', receipts);
            } catch (error) {
                console.error('[FCM] Błąd przy wysyłaniu powiadomienia Expo:', error);
            }
        }

        // Oznacz wydarzenia jako powiadomione w bazie
        if (eventIdsToUpdate.length > 0) {
            const idsList = eventIdsToUpdate.join(',');
            await pool.query(`UPDATE events SET notified = TRUE WHERE id = ANY(ARRAY[${idsList}]::int[])`);
            console.log(`[CRON] Oznaczono ${eventIdsToUpdate.length} wydarzeń jako powiadomione (notified=true).`);
        }

    } catch (err) {
        console.error('[CRON] Błąd podczas sprawdzania powiadomień:', err.message);
    }
}

function initNotificationService() {
    // Od razu odpytaj
    sendPendingNotifications();

    // Następnie co 15 minut
    cron.schedule('*/15 * * * *', () => {
        sendPendingNotifications();
    });

    console.log('[CRON] Silnik powiadomień Expo uruchomiony (co 15 minut).');
}

module.exports = { initNotificationService };
