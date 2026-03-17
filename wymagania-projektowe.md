# SPECYFIKACJA PROJEKTU: SYSTEM CALENDARY (MOBILE ONLY)

## 1. ARCHITEKTURA SYSTEMU
Po ostatnich zmianach architektonicznych zrezygnowano z klienta przeglądarkowego na rzecz 100% skupienia na aplikacji mobilnej. System składa się z dwóch głównych modułów zarządzanych w jednym repozytorium:
- **Backend:** API RESTful (Node.js + Express) komunikujące się z bazą PostgreSQL, działające we własernym kontenerze/serwerze.
- **Mobile App:** Aplikacja Android (React Native / Expo) z powiadomieniami lokalnymi, customizacją i ustawieniami.
- **Infrastruktura:** Serwer udostępniany przez stały tunel Cloudflare (`cloudflared`) podłączony pod własną domenę `slezinski.com` (`api.slezinski.com`) dla bezpiecznego dostępu z każdej sieci bez konfiguracji portów.

## 2. STACK TECHNOLOGICZNY (STRICT)
- **Backend:** Node.js, Express, `pg` (PostgreSQL client), `bcrypt` (hashowanie hasła iteracjami 10 dla balansu speed/security), `jsonwebtoken` (JWT dla sesji).
- **Mobile App:** React Native z frameworkiem Expo, `expo-secure-store` (przechowywanie sesji), `react-native-calendars` (zmodyfikowane pod kropki kolorów), `expo-notifications`, `axios` (z timeoutami 10s).
- **Baza Danych:** PostgreSQL (relacyjna) w Dockerze.
- **Komunikacja:** JSON REST API komunikujące się przez Cloudflare Tunnel.
- **Estetyka Interfejsu:** Nowoczesny design oparty na głębokiej czerni (`#07090F`), konfigurowalnych kolorach wydarzeń z palety, elementach Bottom Sheet oraz minimalistycznym układzie formatek.

## 3. STRUKTURA BAZY DANYCH
Baza danych korzysta ze specjalnych typów obsługujących strefy czasowe (Timezones), aby zapewnić precyzję planowanych zadań.

### Tabela: users
- `id`: SERIAL PRIMARY KEY
- `email`: VARCHAR(255) UNIQUE NOT NULL
- `password_hash`: TEXT NOT NULL
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Tabela: events
- `id`: SERIAL PRIMARY KEY
- `user_id`: INTEGER REFERENCES users(id) ON DELETE CASCADE
- `title`: VARCHAR(255) NOT NULL
- `description`: TEXT
- `start_date`: TIMESTAMPTZ NOT NULL (Wsparcie stref czasowych, poprawny offset lokalny)
- `end_date`: TIMESTAMPTZ (Opcjonalny)
- `color`: VARCHAR(50) (Indywidualny kolor dla wydarzenia, paleta: indigo, red, green, amber, blue, pink)
- `notified`: BOOLEAN DEFAULT FALSE (status powiadomienia)

## 4. WYMAGANIA FUNKCJONALNE

### Moduł Backend (API)
1. **Endpointy Auth:** Logowanie (`POST /auth/login`), Rejestracja (`POST /auth/register`). Szybkie hashowanie dla lepszego UX mobilnego.
2. **Endpointy Calendar:** Pobieranie wydarzeń (`GET /events`), dodawanie (`POST /events`), usuwanie, częściowa edycja. Zapis i obsługa nowej kolumny `color`.
3. **Zarządzanie Czasem Zakończenia:** Obsługa scenariuszy bez godziny zakończenia (wtedy `end_date` ma wartość `NULL`).

### Moduł Mobile (React Native / Expo)
1. **Powiadomienia Lokalne:** Plastyczna strefa powiadomień. Użytkownik decyduje w Ustawieniach o włączeniu uśpień, oraz na ile minut przed wydarzeniem chce je dostawać (od 0 do 120 minut).
2. **Wydarzenia i Customizacja:** Przy dodawaniu eventu z poziomu "Bottom Sheet" użytkownik może podać notatkę, czasy oraz wybrać etykietę kolorystyczną (z predefiniowanej puli 6 kolorów), która pojawia się potem na kalendarzu.
3. **Dystrybucja:** Budowa `.apk` przez serwery EAS w chmurze, bez podpięcia pod Expo Go (ze względu na limity modułu expo-notifications w trybie darmowym deweloperskim dla Androida 13+). Automatyczne ładowanie adresu API w formie produkcyjnej (stała domena `api.slezinski.com`).

## 5. WYMAGANIA INFRASTRUKTURALNE
- Globalny Tunnel Cloudflare trzymający stałą trasę (CNAME) w DNS pod `api.slezinski.com`.
- Lokalne wymuszenie IPv4 w parametrach tunelu (`127.0.0.1:3000`) w Windowsie.
- Bezpieczeństwo zapytań za pomocą nagłówka `Authorization: Bearer <token>` z JWT zapisanym w `SecureStore`.

## 6. ZREALIZOWANE ZMIANY I FIXY (Obecny stan)
- **Top Tabs Nawigacja:** Ekran podzielony na Kalendarz i Agendę za pomocą reagujących na przesunięcia `material-top-tabs`.
- **Zarządzanie Datami:** Porzucenie surowych timestampów na rzecz precyzyjnego `TIMESTAMPTZ` opartego na strefach czasowych. Lokalne aplikowanie dat do widoku Kalendarza.
- **UI/UX (Ultra Polish):**
    - **SVG Clock Picker:** Własny komponent zegara (`react-native-svg` + `PanResponder`) umożliwiający intuicyjne wybieranie godziny i minut poprzez gesty.
    - **Global Alert Layer:** Przeniesienie komunikatów błędów i sukcesów na globalny poziom (`msgModal`), dzięki czemu błędy logowania są zawsze widoczne.
    - **Refined Deletion:** Przebudowany modal usuwania z wysokim kontrastem i czytelnym wyborem zakresu dla wydarzeń cyklicznych.
- **Powiadomienia Expo:** Pełna obsługa SDK 54.

## 7. PLANOWANE ROZSZERZENIA (ROADMAPA 2.0)
Zdecydowano się na następujące kolejne ficzery do implementacji:
1. **Tryb Jasny / Ciemny (Dark/Light Mode)** - automatyczne lub ręczne wsparcie dla obu trybów, z wykorzystaniem nowej palety kolorystycznej.
2. **Widget Android (App Widget)** - zewnętrzny komponent ekranu głównego (np. expo-widgets), wyświetlający top 3 nadchodzące zadania.
3. **Empty States z animacjami Lottie** - estetyczne, animowane stany dla pustych list.
4. **Rozszerzona Cykliczność** - pełna edycja serii wydarzeń i obsługa wyjątków w seriach (RRule).

## 8. STRUKTURA REPOZYTORIUM
- `/backend` - Kod serwerowy Node.js + plik `.env` + `migrate.js`.
- `/mobile-app` - Aplikacja kliencka przeznaczona do kompilacji Expo EAS pod pliki APK.
- `cloudflared.exe` & konfiguracja Cloudflare - Odpowiedzialne za bezobsługowe wystawienie portów do świata. 