# SPECYFIKACJA PROJEKTU: SYSTEM CALENDARY (MONOREPO)

## 1. ARCHITEKTURA SYSTEMU
System składa się z trzech głównych modułów zarządzanych w jednym repozytorium:
- **Backend:** API RESTful (Node.js + Express) komunikujące się z bazą PostgreSQL.
- **Web Frontend:** Aplikacja React (zarządzanie kalendarzem przez przeglądarkę).
- **Mobile App:** Aplikacja Android (Flutter) z powiadomieniami push.
- **Infrastruktura:** Serwer z dostępem przez Cloudflare Tunnel (HTTPS).

## 2. STACK TECHNOLOGICZNY (STRICT)
- **Backend:** Node.js, Express, `pg` (PostgreSQL client), `bcrypt` (hashowanie), `jsonwebtoken` (JWT), `node-cron` (powiadomienia).
- **Baza Danych:** PostgreSQL (relacyjna).
- **Komunikacja:** JSON REST API.
- **Autentykacja:** Bearer Token (JWT).
- **Powiadomienia:** Firebase Cloud Messaging (FCM).

## 3. STRUKTURA BAZY DANYCH (SQL)
### Tabela: users
- `id`: SERIAL PRIMARY KEY
- `email`: VARCHAR(255) UNIQUE NOT NULL
- `password_hash`: TEXT NOT NULL
- `fcm_token`: TEXT (token do powiadomień push na Androida)
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Tabela: events
- `id`: SERIAL PRIMARY KEY
- `user_id`: INTEGER REFERENCES users(id)
- `title`: VARCHAR(255) NOT NULL
- `description`: TEXT
- `start_date`: TIMESTAMP NOT NULL
- `end_date`: TIMESTAMP NOT NULL
- `notified`: BOOLEAN DEFAULT FALSE (status wysłania przypomnienia)

## 4. WYMAGANIA FUNKCJONALNE

### Moduł Backend (API)
1. **Endpointy Auth:** `POST /api/auth/register` oraz `POST /api/auth/login`.
2. **Endpointy Calendar:** `GET /api/events` (filtry po dacie), `POST /api/events`, `PUT /api/events/:id`, `DELETE /api/events/:id`.
3. **Middleware:** Weryfikacja JWT dla wszystkich tras poza logowaniem/rejestracją.
4. **Notification Engine:** Skrypt cron sprawdzający co 15 minut nadchodzące wydarzenia (na następne 24h) i wysyłający push przez Firebase do użytkowników, którzy jeszcze nie dostali powiadomienia (`notified = false`).

### Moduł Web (React)
1. Integracja z biblioteką `FullCalendar`.
2. Widok miesięczny i tygodniowy.
3. Formularz dodawania wydarzenia w oknie Modal.
4. Synchronizacja stanu z API po każdej zmianie.

### Moduł Mobile (Android - Flutter)
1. Logowanie i przechowywanie tokena w `SecureStorage`.
2. Wyświetlanie listy wydarzeń w formie "Agendy".
3. Background Service do obsługi powiadomień Firebase.
4. Powiadomienie lokalne typu: "Masz jutro wydarzenie: [Tytuł] o godzinie [HH:MM]".

## 5. WYMAGANIA INFRASTRUKTURALNE
- **Bezpieczeństwo:** Hasła muszą być solone i hashowane przez `bcrypt`.
- **Dostępność:** API musi działać na porcie 3000 i być wystawione przez Cloudflare Tunnel z certyfikatem SSL.
- **Zmienne środowiskowe:** Wszystkie klucze (DB_URL, JWT_SECRET, FCM_KEY) muszą być w pliku `.env`.

## 6. STRUKTURA REPOZYTORIUM
/backend
/web-frontend
/mobile-app
/docs