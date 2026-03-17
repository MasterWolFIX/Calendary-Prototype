<div align="center">
  <h1>📅 Calendary (Mobile & Backend API)</h1>
  <p><strong>Nowoczesny inteligentny kalendarz z powiadomieniami i zegarem SVG</strong></p>
  <p>System oparty o architekturę rozdzieloną: Backend API (Node.js/PostgreSQL) oraz natywną aplikację mobilną (Expo / React Native) tunelowaną przez Cloudflare.</p>
</div>

---

## 🏗 Stack Technologiczny

- **Baza Danych:** PostgreSQL (Docker) z obsługą TIMESTAMPTZ
- **Backend (API):** Node.js, Express.js, JWT, bcrypt
- **Sieć:** Cloudflare Tunnel (`api.slezinski.com`)
- **Aplikacja Mobilna:** React Native, Expo (SDK 54), SVG Clock Picker, Material Top Tabs

---

## 🚀 Jak uruchomić projekt?

System składa się z trzech współpracujących części:

### 1. Baza Danych i Backend
Baza danych zarządza danymi, a API wystawia je światu. 
1. `docker-compose up -d` (PostgreSQL)
2. `cd backend && npm install`
3. Skonfiguruj `.env` i wykonaj migrację:
   ```bash
   docker exec -i calendary-db-1 psql -U user -d calendar_db < schema.sql
   ```
4. `npm run dev`

### 2. Tunel Cloudflare (Opcjonalnie dla dev)
Aby aplikacja mobilna widziała API bez bawienia się w adresy IP:
1. Uruchom `cloudflared.exe tunnel run calendary-api`.
2. Twój backend będzie teraz dostępny pod publiczną domeną (np. `api.slezinski.com`).

### 3. Aplikacja Mobilna
1. `cd mobile-app && npm install`
2. `npx expo start`
3. Zeskanuj kod QR w aplikacji **Expo Go** na swoim smartfonie.

---

## ✨ Kluczowe Funkcje (V 1.0)

- **SVG Dynamic Clock Picker:** Autorski system wybierania czasu oparty na gestach (`PanResponder` + `react-native-svg`).
- **Powiadomienia Push:** Możliwość ustawienia przypomnień na 15, 30, 60 lub 120 minut przed wydarzeniem.
- **Top Tab Navigation:** Szybkie przełączanie między widokiem miesięcznym (Kalendarz) a listą nadchodzących zadań (Agenda).
- **Cykliczność:** Obsługa wydarzeń powtarzalnych z wyborem zakresu usuwania.
- **Bezpieczeństwo:** Pełne szyfrowanie haseł i autoryzacja sesji za pomocą tokenów JWT.

---

## 🤝 Struktura Repo

```text
/
├── backend/                  # API REST (Node.js)
├── mobile-app/               # React Native (Android / APK)
├── schema.sql                # Struktura bazy PostgreSQL
└── docker-compose.yml        # Konfiguracja kontenera bazy
```

<div align="center">
  <sub>Wykonano przez MasterWolFIX | Design: Ultra Polish Dark Mode</sub>
</div>
