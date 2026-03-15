<div align="center">
  <h1>📅 Calendary (Monorepo)</h1>
  <p><strong>Inteligentny system kalendarza z powiadomieniami Push</strong></p>
  <p>System stworzony w oparciu o architekturę Monorepo zawierający: Backend API (Node.js), Aplikację Webową (React) oraz Aplikację Mobilną (Expo / React Native).</p>
</div>

---

## 🏗 Stack Technologiczny

- **Baza Danych:** PostgreSQL (konteneryzowana w Dockerze)
- **Backend (API):** Node.js, Express.js, `pg`, JWT (JSON Web Tokens), `bcrypt`
- **Powiadomienia:** `node-cron`, Firebase Cloud Messaging (FCM)
- **Frontend Web:** React.js, Vite, FullCalendar, Vanilla CSS (Glassmorphism)
- **Aplikacja Mobilna:** React Native, Expo, React Native Calendars, Expo SecureStore

---

## 🚀 Jak uruchomić projekt na innym urządzeniu?

Aby w pełni korzystać z systemu Calendary, musisz uruchomić 3 osobne instancje w terminalu:
1. Bazę danych i Backend API
2. Frontend Webowy (React)
3. Aplikację Mobilną (Expo)

Poniżej znajdziesz instrukcję krok po kroku.

### Wymagania wstępne
- Zainstalowany **Node.js** (min. v18)
- Zainstalowany **Docker** i **Docker Compose**
- Aplikacja **Expo Go** ze sklepu Google Play / App Store (na fizycznym smartfonie)

---

### Krok 1: Baza Danych i Backend (API)

Backend zarządza wydarzeniami, użytkownikami i harmonogramem powiadomień. 

1. Uruchom kontener z bazą PostgreSQL:
   ```bash
   docker-compose up -d
   ```
2. Przejdź do folderu backendu:
   ```bash
   cd backend
   ```
3. Zainstaluj zależności:
   ```bash
   npm install
   ```
4. Utwórz plik `.env` na podstawie dostarczonego wzoru lub stwórz nowy:
   ```env
   PORT=3000
   DATABASE_URL=postgres://user:password@localhost:5432/calendar_db
   JWT_SECRET=dowolny_dlugi_ciag_znakow_security_key
   FIREBASE_ADMIN_SDK_JSON={}
   ```
5. Wykonaj migrację bazy danych (utworzenie tabel i indeksów):
   ```bash
   docker exec -i calendary-db-1 psql -U user -d calendar_db < schema.sql
   ```
6. Uruchom serwer developerski:
   ```bash
   npm run dev
   ```
   *Serwer API nasłuchuje teraz pod adresem: `http://localhost:3000/api`*

---

### Krok 2: Web Frontend (Przeglądarka)

Aplikacja dla komputerów stacjonarnych z widokiem pełnego kalendarza (miesiąc/tydzień/dzień).

1. Otwórz **nowe okno terminala**.
2. Przejdź do folderu frontendu:
   ```bash
   cd web-frontend
   ```
3. Zainstaluj zależności:
   ```bash
   npm install
   ```
4. Uruchom aplikację React (Vite):
   ```bash
   npm run dev
   ```
   *Frontend wystartuje na adresie: `http://localhost:5173`. Zostaniesz od razu przekierowany do pięknego ekranu logowania (Glassmorphism).*

---

### Krok 3: Aplikacja Mobilna (Android / iOS)

Aplikacja na telefon z responsywnym widokiem "Agendy". Pozwala na podgląd zaplanowanych wydarzeń z dowolnego miejsca.

1. Otwórz **kolejne (trzecie) okno terminala**.
2. Upewnij się, że Twój telefon i Twój komputer są podłączone do tej samej sieci Wi-Fi.
3. Znajdź lokalny adres IP swojego komputera:
   - Windows: Wpisz `ipconfig` i skopiuj `IPv4 Address` (np. `192.168.1.55`).
   - Mac/Linux: Wpisz `ifconfig`.
4. Wejdź do pliku `mobile-app/App.js` i znajdź w **23 linii** zmienną `API_URL`. Zmień `localhost` na swój adres IP!
   ```javascript
   // PRZED: 
   // const API_URL = 'http://localhost:3000/api';
   // PO (Przykład):
   const API_URL = 'http://192.168.1.55:3000/api';
   ```
5. Przejdź do folderu mobilki i odpal serwer Expo:
   ```bash
   cd mobile-app
   npm install
   npm start
   ```
6. **Magia!** ✨ W terminalu wyświetli się wielki kod QR.
   - Odpal aplikację aparatu w swoim smartfonie i zeskakuj go (albo odpal pobraną w Google Play aplikację **Expo Go**).
   - Aplikacja załaduje się bezprzewodowo. Możesz zalogować się tym samym kontem co na stronie www! 

---

## 🤝 Struktura Repo (Monorepo)

```text
/
├── backend/                  # Serwer Node.js (API REST)
│   ├── routes/               # Endpointy (auth.js, events.js)
│   ├── services/             # Usługi tła (Cron dla Firebase Push)
│   ├── middleware/           # Weryfikacja tokenów JWT
│   └── schema.sql            # Definicje tabel bazy
├── web-frontend/             # Aplikacja w przeglądarce (React.js)
│   ├── src/pages/            # Ekran Kalendarza i Logowania
│   └── src/index.css         # Stylizacja (Dark Glassmorphism)
├── mobile-app/               # Aplikacja na telefon (React Native / Expo)
│   └── App.js                # Główna logika Agendy i SecureStore
└── docker-compose.yml        # Prosta instancja i przetrzymywanie lokalnie bazy PostgreSQL 
```

<div align="center">
  <sub>Wykonano przez MasterWolFIX | Zabezpieczono haszowaniem bcrypt.</sub>
</div>
