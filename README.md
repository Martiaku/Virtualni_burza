# Virtualní burza / Virtual Stock Exchange

Vzdělávací webová aplikace pro simulaci investování s fiktivními penězi.

The educational web application for practicing investments with virtual money.

## Obsah / Contents

- [Česky](#čeština)
- [English](#english)
- [Podrobná dokumentace / Detailed documentation](docs/SOFTWARE_DOCUMENTATION.md)

---

## Čeština

### Přehled

Virtualní burza umožňuje uživateli bezpečně trénovat nákup a prodej akcií bez
použití skutečných peněz. Každý účet začíná s virtuálním kapitálem **100 000 Kč**.
Tržní data se načítají přes backend z Finnhub API, takže API klíč není vystaven
v prohlížeči.

### Funkce

- registrace, přihlášení a odhlášení,
- vlastní virtuální účet pro každého uživatele,
- přehled celkové hodnoty portfolia, hotovosti a investic,
- nákup akcií za aktuální kotaci,
- prodej pouze celých kusů a nejvýše do vlastněného množství,
- potvrzovací tabulka před nákupem i prodejem,
- hromadný prodej všech pozic s kontrolní tabulkou,
- výpočet průměrné nákupní ceny,
- výpočet zisku/ztráty v Kč a procentech,
- historie transakcí,
- vyhledávání akcií dostupných ve Finnhubu,
- detail akcie s historickými daty, pokud je tarif Finnhub poskytuje,
- automatická aktualizace kotací každých 60 sekund s odpočtem,
- responzivní rozhraní s pevným levým menu na desktopu.

### Technologie

- **Backend:** Python, Django, Django REST Framework
- **Frontend:** React, TypeScript, Vite
- **Databáze:** SQLite pro lokální vývoj
- **Tržní data:** Finnhub REST API
- **Autentizace:** Django session authentication
- **Ikony:** Lucide React

### Požadavky

- Python 3.12 nebo novější
- Node.js 20 nebo novější
- npm
- Finnhub API klíč (volitelný pro demo režim)

### Instalace a spuštění

#### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend poběží na `http://localhost:8000`.

#### 2. API klíč Finnhub

Vytvořte soubor `.env` v kořenu projektu:

```env
FINNHUB_API_KEY=váš_finnhub_api_klíč
```

Po změně souboru `.env` restartujte Django server. Bez klíče aplikace používá
lokální demo kotace pro základní sadu titulů.

#### 3. Frontend

V druhém terminálu:

```powershell
cd frontend
npm install
npm run dev
```

Frontend poběží na `http://localhost:5173`.

Produkční build:

```powershell
npm run build
```

### API endpointy

| Metoda | Endpoint | Popis |
|---|---|---|
| GET | `/api/auth/csrf/` | Inicializace CSRF cookie |
| POST | `/api/auth/register/` | Registrace účtu |
| POST | `/api/auth/login/` | Přihlášení |
| POST | `/api/auth/logout/` | Odhlášení |
| GET | `/api/auth/me/` | Přihlášený uživatel |
| GET | `/api/market/` | Oblíbené kotace |
| GET | `/api/market/search/?q=AAP` | Vyhledání symbolů |
| GET | `/api/market/AAPL/` | Kotace jednoho symbolu |
| GET | `/api/market/AAPL/detail/` | Kotace a historická data |
| GET | `/api/portfolio/` | Portfolio a poslední obchody |
| POST | `/api/trades/` | Nákup nebo prodej |
| POST | `/api/trades/sell-all/` | Prodej všech pozic |

### Bezpečnostní poznámky

- API klíč Finnhub patří pouze do backendového `.env` souboru.
- Klíč nikdy nevkládejte do Reactu ani do `frontend/.env`.
- `.env`, databáze, virtuální prostředí a build výstupy jsou ignorované přes
  `.gitignore`.
- Backend kontroluje hotovost, množství, směr obchodu i vlastnictví pozice.
- Pro produkci nastavte vlastní `DJANGO_SECRET_KEY`, vypněte `DEBUG` a použijte
  PostgreSQL nebo jinou vhodnou produkční databázi.

---

## English

### Overview

Virtual Stock Exchange is an educational web application for practicing stock
trading without real money. Every account starts with **CZK 100,000** in virtual
capital. Market data is requested by the backend from the Finnhub API, keeping
the API key out of the browser.

### Features

- user registration, login and logout,
- separate virtual account for every user,
- portfolio value, cash and investment overview,
- stock purchases at the current quote,
- whole-share sales limited to the owned quantity,
- confirmation table before every purchase and sale,
- sell-all workflow with a review table,
- average purchase price calculation,
- profit/loss calculation in CZK and percent,
- transaction history,
- search for Finnhub-supported symbols,
- stock details and historical data when available in the Finnhub plan,
- automatic quote refresh every 60 seconds with a countdown,
- responsive interface with a fixed desktop sidebar.

### Technology

- **Backend:** Python, Django, Django REST Framework
- **Frontend:** React, TypeScript, Vite
- **Database:** SQLite for local development
- **Market data:** Finnhub REST API
- **Authentication:** Django session authentication
- **Icons:** Lucide React

### Requirements

- Python 3.12 or newer
- Node.js 20 or newer
- npm
- Finnhub API key (optional when using demo mode)

### Installation and startup

#### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The backend runs at `http://localhost:8000`.

#### 2. Finnhub API key

Create `.env` in the project root:

```env
FINNHUB_API_KEY=your_finnhub_api_key
```

Restart Django after changing `.env`. Without a key, the application uses local
demo quotes for the initial set of symbols.

#### 3. Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

Production build:

```powershell
npm run build
```

### License and data disclaimer

This project is intended for education and simulation only. It does not execute
real trades and does not provide investment advice. Check Finnhub's current
licensing terms and API limits before deploying or redistributing market data.
