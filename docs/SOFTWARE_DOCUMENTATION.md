# Dokumentace softwaru / Software Documentation

## Obsah / Contents

- [English](#english)
- [Čeština](#čeština)

### English

## 1. Application purpose

Virtual Stock Exchange is an educational investment simulator. A user creates
an account, receives virtual starting capital, follows market quotes, simulates
buy and sell orders, and evaluates portfolio performance.

## 2. Architecture

```text
React + TypeScript + Vite
            |
       REST / JSON
            |
Django + Django REST Framework
            |
     SQLite / PostgreSQL
            |
       Finnhub API
```

The frontend never calls Finnhub directly. The Django backend reads
`FINNHUB_API_KEY`, requests market data, applies caching and returns only the
data required by the frontend.

### Main project areas

|  Path | Purpose |
|---|---|
| `backend/config/` | Django configuration and WSGI entry point |
| `backend/trading/models.py` | Account, Holding and Trade models |
| `backend/trading/market.py` | Finnhub integration, caching and demo quotes |
| `backend/trading/views.py` | Authentication, market and trading API views |
| `backend/trading/serializers.py` | REST response serialization |
| `frontend/src/App.tsx` | Authentication flow, navigation and application UI |
| `frontend/src/styles.css` | Responsive visual design and modal layouts |

## 3. Data model

### Account

- one-to-one relation to a Django user,
- current virtual cash balance,
- default starting balance: CZK 100,000.

### Holding

- account and stock symbol,
- company name,
- owned quantity,
- weighted average purchase price,
- calculated market value and unrealized profit/loss.

### Trade

- account,
- symbol and company name,
- side: `BUY` or `SELL`,
- quantity, executed price and total value,
- execution timestamp.

## 4. Trading rules

1. A purchase is allowed only when sufficient cash is available.
2. A sale requires an existing holding.
3. Sales accept whole shares only.
4. Sold quantity cannot exceed the owned quantity.
5. Every trade is confirmed in a modal dialog before submission.
6. The backend validates all rules again; protection does not depend on the UI.
7. Additional purchases of the same symbol update the weighted average purchase price.
8. “Sell all” creates a separate history record for every holding.

## 5. Market data

The integration uses the Finnhub REST API:

- `/quote` for current quotes,
- `/search` for symbol search,
- `/stock/candle` for daily historical candles.

Current quotes are cached for 30 seconds on the backend. The frontend refreshes
the market list once per minute to stay within the Finnhub Free rate limit.
Historical candles may be unavailable depending on the account plan; in that
case the detail dialog displays a clear availability message.

## 6. Authentication

The application uses Django session authentication:

1. the frontend initializes a CSRF cookie,
2. registration or login creates a Django session,
3. subsequent requests include cookies via `credentials: "include"`,
4. protected endpoints require an authenticated session,
5. logout invalidates the session.

The current implementation intentionally uses a standard Django user model.
Password validation is handled by Django's password hashing and authentication
stack.

## 7. User interface

The authenticated application contains:

- fixed desktop sidebar,
- overview dashboard,
- market list with symbol search,
- quick trade panel,
- portfolio table,
- transaction history,
- stock detail modal,
- buy, sell and sell-all confirmation modals,
- refresh countdown,
- responsive mobile layout.

The summary cards display:

- total portfolio value and total return relative to CZK 100,000,
- available cash,
- invested value,
- unrealized profit/loss in CZK and percent if positions exist.

## 8. Production configuration

Before production deployment:

1. set a strong `DJANGO_SECRET_KEY`,
2. set `DJANGO_DEBUG=0`,
3. configure production `ALLOWED_HOSTS`,
4. configure trusted HTTPS origins and secure cookies,
5. replace SQLite with PostgreSQL for multi-user production workloads,
6. put Finnhub API key in a secret manager or protected environment variable,
7. configure a production WSGI/ASGI server,
8. review Finnhub licensing and redistribution restrictions.

## 9. Validation

The project has been validated with:

```powershell
cd backend
python manage.py check
```

```powershell
cd frontend
npm run build
```

The API flow has also been smoke-tested for registration, session authentication,
portfolio access, market quotes and trade creation.

## 10. Limitations

- This is a simulation, not a real brokerage platform.
- Quote availability depends on Finnhub coverage and plan limits.
- Historical candle data may return HTTP 403 on restricted Finnhub plans.
- The current UI uses one-minute polling rather than websocket streaming.
- The demo quote fallback contains only the initial featured symbols.
- There are no real orders, broker connections, dividends, fees, short positions
  or multi-currency settlement in the current MVP.

## 11. License and disclaimer

This project is intended for education and simulation only. It does not execute
real trades and does not provide investment advice. Before public deployment,
review the licenses and terms of all third-party services, especially Finnhub,
and add a project-specific software license if the project is redistributed.

### Čeština

## 1. Účel aplikace

Virtualní burza je vzdělávací simulátor investování. Uživatel si vytvoří účet,
obdrží virtuální počáteční kapitál a může sledovat tržní kotace, simulovat nákupy
a prodeje a vyhodnocovat vývoj svého portfolia.

## 2. Architektura

```text
React + TypeScript + Vite
            |
       REST / JSON
            |
Django + Django REST Framework
            |
     SQLite / PostgreSQL
            |
       Finnhub API
```

Frontend nikdy nevolá Finnhub přímo. Backend v Djangu načte `FINNHUB_API_KEY`, vyžádá si tržní data, uplatní cachování a vrátí pouze ta data, která frontend potřebuje.

### Hlavní část projektu

| Cesta | Účel |
|---|---|
| `backend/config/` | Konfigurace Django a vstupní bod WSGI |
| `backend/trading/models.py` | Modely účtů a obchodování |
| `backend/trading/market.py` | Integrace s Finnhubem, ukládání do mezipaměti a demo kotace |
| `backend/trading/views.py` | Autorizace, trh a obchodování API |
| `backend/trading/serializers.py` | Serializace REST |
| `frontend/src/App.tsx` | Proces autentizace, navigace a uživatelského rozhraní aplikace |
| `frontend/src/styles.css` | Responzivní design a rozvržení |

## 3. Datový model

### Účet

- vztah 1:1 k uživateli v systému Django,
- aktuální zůstatek virtuální hotovosti,
- výchozí počáteční zůstatek: 100 000 CZK.

### Držená pozice

- účet a symbol akcie,
- název společnosti,
- držené množství,
- vážená průměrná nákupní cena,
- vypočtená tržní hodnota a nerealizovaný zisk či ztráta.

### Obchod

- účet,
- symbol a název společnosti,
- strana obchodu: `BUY` (nákup) nebo `SELL` (prodej),
- množství, realizační cena a celková hodnota,
- čas provedení.

## 4. Obchodní pravidla

1. Nákup je možný pouze při dostatku volné hotovosti.
2. Prodej je možný pouze pro existující pozici.
3. Prodej přijímá pouze celé kusy.
4. Prodané množství nesmí překročit vlastněné množství.
5. Každý obchod se před odesláním potvrzuje v modálním dialogu.
6. Backend pravidla ověřuje znovu, takže ochrana nezávisí pouze na frontendu.
7. Při dalším nákupu stejného titulu se přepočítá vážená průměrná nákupní cena.
8. „Prodat vše“ vytvoří pro každou pozici samostatný záznam v historii.

## 5. Tržní data

Integrace využívá REST API služby Finnhub:

- `/quote` pro aktuální cenové údaje,
- `/search` pro vyhledávání symbolů,
- `/stock/candle` pro denní historická data (svíčkové grafy).

Aktuální cenové údaje jsou na backendu ukládány do mezipaměti s platností 30 sekund.
Frontend aktualizuje seznam trhů jednou za minutu, aby nepřekročil limit
bezplatného tarifu služby Finnhub. Historická data nemusí být v závislosti
na tarifu účtu dostupná; v takovém případě se v dialogovém okně s podrobnostmi
zobrazí srozumitelné upozornění na nedostupnost.

## 6. Autentizace

Aplikace využívá autentizaci pomocí sessions v rámci frameworku Django:

1. frontend inicializuje CSRF cookie,
2. registrace nebo přihlášení vytvoří Django session,
3. následné požadavky zahrnují cookies díky nastavení `credentials: "include"`,
4. chráněné koncové body vyžadují autentizovanou session,
5. odhlášení session zneplatní.

Současná implementace záměrně využívá standardní uživatelský model frameworku Django.
Validaci hesel zajišťuje mechanismus pro hašování hesel a autentizační systém
této platformy.

## 7. Uživatelské rozhraní

Aplikace po přihlášení obsahuje:

- pevný postranní panel,
- přehledový dashboard,
- seznam trhů s možností vyhledávání symbolů,
- panel pro rychlé obchodování,
- tabulku portfolia,
- historii transakcí,
- modální okno s detailem akcie,
- potvrzovací okna pro nákup, prodej a prodej všech pozic,
- odpočet do obnovení dat,
- responzivní mobilní rozvržení.

Souhrnné karty zobrazují:

- celkovou hodnotu portfolia a celkový výnos vztažený k částce 100 000 CZK,
- dostupnou hotovost,
- investovanou částku,
- nerealizovaný zisk či ztrátu v CZK a v procentech (pokud existují otevřené pozice).

## 8. Konfigurace produkce

Před nasazením do produkce:

1. nastavte silný `DJANGO_SECRET_KEY`,
2. nastavte `DJANGO_DEBUG=0`,
3. nakonfigurujte produkční `ALLOWED_HOSTS`,
4. nakonfigurujte důvěryhodné HTTPS původy (origins) a zabezpečené cookies,
5. pro produkční provoz s více uživateli nahraďte SQLite databází PostgreSQL,
6. uložte API klíč pro Finnhub do správce tajných údajů nebo do chráněné proměnné prostředí,
7. nakonfigurujte produkční WSGI/ASGI server,
8. prostudujte si licenční podmínky a omezení týkající se dalšího šíření dat služby Finnhub.

## 9. Ověření

Projekt byl ověřen pomocí následujících příkazů:

```powershell
cd backend
python manage.py check
```

```powershell
cd frontend
npm run build
```

U API byl rovněž proveden základní test funkčnosti (smoke test) zahrnující registraci, autentizaci relace,
přístup k portfoliu, tržní kotace a vytváření obchodů.

## 10. Omezení

- Toto je simulace, nikoli skutečná brokerská platforma.
- Dostupnost kotací závisí na pokrytí Finnhubu a limitech plánu.
- Historická data svíček mohou u omezených plánů Finnhub vracet chybu HTTP 403.
- Aktuální uživatelské rozhraní používá minutové dotazování namísto streamování přes websocket.
- Záložní demo kotace obsahuje pouze původní symboly.
- V aktuálním MVP nejsou žádné skutečné objednávky, brokerská spojení, dividendy, poplatky, krátké pozice ani vypořádání ve více měnách.

## 11. Licence a upozornění

Tento projekt je určen výhradně pro vzdělávací účely a simulace. Neprovádí skutečné obchodní transakce ani neposkytuje investiční poradenství. Před veřejným nasazením si prostudujte licenční podmínky všech služeb třetích stran (zejména služby Finnhub) a v případě dalšího šíření projektu k němu přiložte příslušnou softwarovou licenci.