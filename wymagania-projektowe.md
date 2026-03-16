# SPECYFIKACJA PROJEKTU: SYSTEM CALENDARY (MONOREPO)

## 1. ARCHITEKTURA SYSTEMU
System składa się z trzech głównych modułów zarządzanych w jednym repozytorium:
- **Backend:** API RESTful (Node.js + Express) komunikujące się z bazą PostgreSQL.
- **Web Frontend:** Aplikacja w React i Vite (zarządzanie kalendarzem przez przeglądarkę).
- **Mobile App:** Aplikacja Android/iOS (React Native / Expo) z powiadomieniami lokalnymi i push.
- **Infrastruktura:** Serwer udostępniany przez tunel Cloudflare (`cloudflared`) dla bezpiecznego dostępu zewnętrznego.

## 2. STACK TECHNOLOGICZNY (STRICT)
- **Backend:** Node.js, Express, `pg` (PostgreSQL client), `bcrypt` (hashowanie hasła), `jsonwebtoken` (JWT dla sesji).
- **Web Frontend:** React (Vite), React Router, `@fullcalendar/react`, Axios.
- **Mobile App:** React Native z frameworkiem Expo, `expo-secure-store` (przechowywanie sesji), `react-native-calendars`, `expo-notifications`.
- **Baza Danych:** PostgreSQL (relacyjna).
- **Komunikacja:** JSON REST API (wspierające cross-origin dla urządzeń mobilnych/przeglądarek).
- **Estetyka Interfejsu:** Nowoczesny design "Indigo" oparty na głębokiej czerni (`#07090F`), wyraźnych akcentach (`#6366f1`) oraz pełnej wektoryzacji SVG (kategoryczny zakaz stosowania ikon Emoji).

## 3. STRUKTURA BAZY DANYCH
Baza danych korzysta ze specjalnych typów obsługujących strefy czasowe (Timezones), aby zapewnić precyzję planowanych zadań.

### Tabela: users
- `id`: SERIAL PRIMARY KEY
- `email`: VARCHAR(255) UNIQUE NOT NULL
- `password_hash`: TEXT NOT NULL
- `fcm_token`: TEXT (token do powiadomień na urządzeniach mobilnych)
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Tabela: events
- `id`: SERIAL PRIMARY KEY
- `user_id`: INTEGER REFERENCES users(id) ON DELETE CASCADE
- `title`: VARCHAR(255) NOT NULL
- `description`: TEXT
- `start_date`: TIMESTAMPTZ NOT NULL (Wsparcie stref czasowych)
- `end_date`: TIMESTAMPTZ (Opcjonalny)
- `color`: VARCHAR(50) (Domyślnie używany spójny kolor akcentowy aplikacji)
- `notified`: BOOLEAN DEFAULT FALSE (status powiadomienia po stronie API)

## 4. WYMAGANIA FUNKCJONALNE

### Moduł Backend (API)
1. **Endpointy Auth:** Logowanie (`POST /auth/login`), Rejestracja (`POST /auth/register`) z wymogiem `confirmPassword` obsługiwanym na froncie oraz powtarzania hasła.
2. **Endpointy Calendar:** Pobieranie wydarzeń (`GET /events`), dodawanie (`POST /events`), usuwanie dają swobodny dostęp i formatowanie stref czasowych (UTC -> Lokalny).
3. **Zarządzanie Czasem Zakończenia:** Obsługa scenariuszy bez godziny zakończenia (wtedy `end_date` ma wartość `NULL`).
4. **Middleware:** Weryfikacja tokena JWT i zabezpieczenie 401 z automatycznym wylogowaniem sesji na froncie.

### Moduł Web (React)
1. **Uwierzytelnianie:** Funkcja "Zapamiętaj mnie na tym urządzeniu" (przechowująca JWT i sesję w `localStorage` lub `sessionStorage`).
2. **Design:** Odświeżony Layout. Sidebar z wektorowymi narzędziami ikon (SVG) oraz statystykami dziennymi na górnym pasku.
3. **Wydarzenia:** Pełna obsługa Drag&Drop w module modułu pełnego widoku `FullCalendar`. Checkbox `Czas zakończenia` domyślnie wyłączony.

### Moduł Mobile (React Native / Expo)
1. **Powiadomienia Lokalne:** Aplikacja z wyprzedzeniem czasowym zaplanuje zawiadomienie systemowe dokładnie 15 minut przed wydarzeniem (za pomocą paczki `expo-notifications`).
2. **Interfejs Użytkownika:** Minimalistyczny interfejs z ciemnym motywem oraz Modal typu "Bottom Sheet" do wprowadzania nowych eventów.
3. **OTA Updates:** Kod jest budowany tak, by w przyszłości obsłużyć Expo EAS Updates i wysyłać poprawki bez konieczności reinstalacji pliku `.apk`.

## 5. WYMAGANIA INFRASTRUKTURALNE
- Hasła w bazie danych są hashowane paczką `bcrypt`.
- Bezpieczeństwo zAPY za pomocą nagłówka `Authorization: Bearer <token>`.
- Brak lokalnych hard-coded IP do backendu u klienta mobilnego podczas dystrybucji docelowej. Łączność kierowana głównie przez Cloudflare (np. `trycloudflare.com`).

## 6. STRUKTURA REPOZYTORIUM
- `/backend` - kod serwerowy Node.js + pliki konfiguracyjne SQL.
- `/web-frontend` - Panel internetowy dla przeglądarki (Vite).
- `/mobile-app` - Aplikacja kliencka przeznaczona do kompilacji Expo (EAS Build).