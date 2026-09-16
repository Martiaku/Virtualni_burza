import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  History,
  LogOut,
  Search,
  Wallet,
} from "lucide-react";

const API = "http://localhost:8000/api";

type Quote = {
  symbol: string;
  name: string;
  price: string | null;
  change_percent: string | null;
};

type Holding = {
  symbol: string;
  company_name: string;
  quantity: string;
  average_price: string;
  current_price: string;
  market_value: string;
  profit: string;
  profit_percent: string;
};

type Trade = {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  price: string;
  total: string;
  executed_at: string;
};

type Portfolio = {
  cash: string;
  invested_value: string;
  total_value: string;
  holdings: Holding[];
  trades: Trade[];
};

type User = {
  username: string;
  email: string;
};

type StockDetail = {
  quote: Quote;
  history: { time: number; close: number }[];
};

// Pomocné funkce
const money = (value: string | number) =>
  `${Number(value).toLocaleString("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Kč`;

const percent = (value: string | number) =>
  `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)} %`;

const csrf = () =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="))
    ?.split("=")[1] ?? "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      ...(options.method && options.method !== "GET"
        ? { "X-CSRFToken": csrf() }
        : {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail ?? "Požadavek se nepodařilo dokončit.");
  }
  return body;
}

// Komponenta pro Přihlášení / Registraci
function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const user = await request<User>(
        register ? "/auth/register/" : "/auth/login/",
        {
          method: "POST",
          body: JSON.stringify({ username, email, password }),
        }
      );
      onLogin(user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Přihlášení se nepodařilo."
      );
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>VIRTUÁLNÍ</strong>
            <small>BURZA</small>
          </div>
        </div>
        <p className="eyebrow">{register ? "NOVÝ ÚČET" : "VÍTEJTE ZPĚT"}</p>
        <h1>{register ? "Vytvořte si účet" : "Přihlaste se"}</h1>
        <p className="muted">
          {register
            ? "Začněte trénovat investování s fiktivními penězi."
            : "Pokračujte do svého simulovaného portfolia."}
        </p>

        {error && <div className="notice error">{error}</div>}

        <form onSubmit={submit}>
          <label>
            Uživatelské jméno
            <input
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          {register && (
            <label>
              E-mail (volitelné)
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          <label>
            Heslo
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary-button" type="submit">
            {register ? "Registrovat se" : "Přihlásit se"}
          </button>
        </form>

        <button
          className="link-button"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Už máte účet? Přihlásit se"
            : "Ještě nemáte účet? Registrovat se"}
        </button>
      </div>
    </div>
  );
}

// Hlavní Aplikace
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [page, setPage] = useState("overview");

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [selected, setSelected] = useState<Quote | null>(null);

  const [quantity, setQuantity] = useState("1");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [showSellAll, setShowSellAll] = useState(false);
  const [tradeConfirmation, setTradeConfirmation] = useState<"BUY" | "SELL" | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);

  // Načtení přihlášeného uživatele
  useEffect(() => {
    request<User>("/auth/me/")
      .then(setUser)
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  // Načtení dat trhu a portfolia po přihlášení
  useEffect(() => {
    if (!user) return;
    Promise.all([request<Quote[]>("/market/"), request<Portfolio>("/portfolio/")])
      .then(([market, account]) => {
        setQuotes(market);
        setPortfolio(account);
        setSelected((current) => current ?? market[0]);
      })
      .catch((err) => setNotice(err.message));
  }, [user]);

  // Automatická aktualizace kurzů každých 60s
  useEffect(() => {
    if (!user) return;

    const refreshQuotes = () =>
      request<Quote[]>("/market/")
        .then((market) => {
          setQuotes(market);
          setSelected((current) =>
            current
              ? market.find((quote) => quote.symbol === current.symbol) ?? current
              : market[0]
          );
        })
        .catch((err) => setNotice(err.message));

    const interval = window.setInterval(refreshQuotes, 60_000);
    const countdown = window.setInterval(
      () => setSecondsToRefresh((seconds) => (seconds <= 1 ? 60 : seconds - 1)),
      1_000
    );

    return () => {
      window.clearInterval(interval);
      window.clearInterval(countdown);
    };
  }, [user]);

  // Vyhledávání v trhu
  useEffect(() => {
    if (!user || search.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      request<Quote[]>(`/market/search/?q=${encodeURIComponent(search)}`)
        .then(setQuotes)
        .catch((err) => setNotice(err.message));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search, user]);

  const refreshPortfolio = async () =>
    setPortfolio(await request<Portfolio>("/portfolio/"));

  const trade = async (side: "BUY" | "SELL") => {
    if (!selected) return;
    if (
      side === "SELL" &&
      (!Number.isInteger(Number(quantity)) ||
        Number(quantity) > Number(selectedHolding?.quantity ?? 0))
    ) {
      setNotice(
        `Prodat můžete pouze celé kusy, maximálně ${selectedHolding?.quantity ?? 0} ks.`
      );
      return;
    }
    setTradeConfirmation(side);
  };

  const sellAll = async () => {
    try {
      await request("/trades/sell-all/", { method: "POST" });
      setNotice("Všechny pozice byly prodány.");
      setShowSellAll(false);
      await refreshPortfolio();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Pozice se nepodařilo prodat."
      );
    }
  };

  const confirmTrade = async () => {
    if (!tradeConfirmation || !selected) return;
    const side = tradeConfirmation;
    setTradeConfirmation(null);

    try {
      await request("/trades/", {
        method: "POST",
        body: JSON.stringify({ symbol: selected.symbol, side, quantity }),
      });
      setNotice(side === "BUY" ? "Nákup byl proveden." : "Prodej byl proveden.");
      await refreshPortfolio();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Prodej se nepodařil.");
    }
  };

  const handleResetPortfolio = async () => {
    setShowResetModal(false);
    try {
      await request("/portfolio/reset/", { method: "POST" });
      setNotice("Portfolio bylo úspěšně resetováno na 100 000 Kč.");
      await refreshPortfolio();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Portfolio se nepodařilo resetovat.");
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      await request("/auth/logout/", { method: "POST" });
      setUser(null);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Odhlášení se nepodařilo.");
    }
  };

  const selectedHolding = portfolio?.holdings.find(
    (holding) => holding.symbol === selected?.symbol
  );

  const openDetail = async (symbol: string) => {
    try {
      setDetail(await request<StockDetail>(`/market/${symbol}/detail/`));
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Detail se nepodařil načíst."
      );
    }
  };

  const filteredQuotes = useMemo(
    () =>
      quotes.filter((quote) =>
        `${quote.symbol} ${quote.name}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [quotes, search]
  );

  if (!authChecked) return <div className="loading">Načítám Virtuální burzu</div>;
  if (!user) return <Auth onLogin={setUser} />;
  if (!portfolio) return <div className="loading">Načítám vaše portfolio</div>;

  const totalValue = Number(portfolio.total_value);
  const totalReturn = ((totalValue - 100000) / 100000) * 100;
  const investedCost = portfolio.holdings.reduce(
    (sum, holding) => sum + Number(holding.quantity) * Number(holding.average_price),
    0
  );
  const investedProfit = portfolio.holdings.reduce(
    (sum, holding) => sum + Number(holding.profit),
    0
  );
  const investedReturn = investedCost ? (investedProfit / investedCost) * 100 : 0;
  const isMarket = page === "market";
  const estimatedTotal = Number(quantity || 0) * Number(selected?.price ?? 0);
  const canBuy = estimatedTotal > 0 && estimatedTotal <= Number(portfolio.cash);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>VIRTUÁLNÍ</strong>
            <small>BURZA</small>
          </div>
        </div>
        <nav>
          {[
            ["overview", "Přehled", BarChart3],
            ["market", "Trhy", Activity],
            ["portfolio", "Portfolio", Wallet],
            ["history", "Historie", History],
          ].map(([id, label, Icon]) => (
            <button
              key={id as string}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id as string)}
            >
              <Icon size={18} />
              {label as string}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" /> Demo režim
          <div>Obchodujete s fiktivními penězi.</div>
        </div>
        <div className="profile">
          <button
            className="avatar avatar-button"
            onClick={() => setProfileMenuOpen((open) => !open)}
            aria-expanded={profileMenuOpen}
            aria-label="Otevřít uživatelské menu"
          >
            {user.username[0].toUpperCase()}
          </button>
          <div>
            <b>{user.username}</b>
            <small>Simulovaný účet opravdu neobsahuje peníze.</small>
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  setShowLogoutModal(true);
                }}
              >
                <LogOut size={15} /> Odhlásit se
              </button>
              <button
                className="reset-menu-item"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setShowResetModal(true);
                }}
              >
                Reset portfolia
              </button>
            </div>
          )}
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">
              {page === "overview" ? "PŘEHLED ÚČTU" : page.toUpperCase()}
            </p>
            <h1>
              {page === "overview"
                ? `Dobré ráno, ${user.username}.`
                : page === "market"
                ? "Trhy"
                : page === "portfolio"
                ? "Vaše portfolio"
                : "Historie transakcí"}
            </h1>
            <p className="muted">
              Sledujte své portfolio a objevujte nové příležitosti.
            </p>
          </div>
        </header>

        {notice && (
          <div className="notice">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}

        <section className="stats">
          <div className="stat-card primary">
            <span>Celková hodnota portfolia</span>
            <strong>{money(portfolio.total_value)}</strong>
            <em className={totalReturn >= 0 ? "positive" : "negative"}>
              {totalReturn >= 0 ? "▲" : "▼"} {percent(totalReturn)} celkově
            </em>
            <div className="sparkline" />
          </div>
          <div className="stat-card">
            <span>Volná hotovost</span>
            <strong>{money(portfolio.cash)}</strong>
            <small>K dispozici pro investování</small>
          </div>
          <div className="stat-card">
            <span>Investováno</span>
            <strong>{money(portfolio.invested_value)}</strong>
            <em className={investedReturn >= 0 ? "positive" : "negative"}>
              {investedReturn >= 0 ? "▲" : "▼"} {money(investedProfit)} /{" "}
              {percent(investedReturn)} při okamžitém prodeji
            </em>
            <small>{portfolio.holdings.length} aktiv v portfoliu</small>
            <button
              className="sell-all-button"
              onClick={() => setShowSellAll(true)}
              disabled={!portfolio.holdings.length}
            >
              Prodat vše
            </button>
          </div>
          <div className="refresh-status">
            Další aktualizace cen za{" "}
            <b>00:{String(secondsToRefresh).padStart(2, "0")}</b>
          </div>
        </section>

        {(page === "overview" || isMarket) && (
          <div className="content-grid">
            <section className="panel market-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">TRH</p>
                  <h2>Oblíbené akcie</h2>
                </div>
                <div className="search">
                  <Search size={17} />
                  <input
                    placeholder="Hledat symbol nebo název"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="quote-list">
                {filteredQuotes.map((quote) => (
                  <div
                    key={quote.symbol}
                    className={`quote-row ${
                      selected?.symbol === quote.symbol ? "selected" : ""
                    }`}
                    onClick={() => setSelected(quote)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) =>
                      event.key === "Enter" && setSelected(quote)
                    }
                  >
                    <span className="ticker">{quote.symbol[0]}</span>
                    <span className="quote-name">
                      <b>{quote.symbol}</b>
                      <small>{quote.name}</small>
                    </span>
                    <span className="quote-price">
                      {quote.price === null ? "—" : money(quote.price)}
                    </span>
                    <span
                      className={
                        quote.change_percent === null
                          ? "muted"
                          : Number(quote.change_percent) >= 0
                          ? "positive"
                          : "negative"
                      }
                    >
                      {quote.change_percent === null
                        ? "Kotace po výběru"
                        : percent(quote.change_percent)}
                    </span>
                    <button
                      className="detail-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetail(quote.symbol);
                      }}
                    >
                      Detail
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel order-panel">
              <p className="eyebrow">RYCHLÝ OBCHOD</p>
              <h2>
                {selected?.symbol} <span>{selected?.name}</span>
              </h2>
              <div className="order-price">
                {money(selected?.price ?? 0)}{" "}
                <span
                  className={
                    Number(selected?.change_percent) >= 0
                      ? "positive"
                      : "negative"
                  }
                >
                  {percent(selected?.change_percent ?? 0)}
                </span>
              </div>
              <label>
                Množství (ks)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              {selectedHolding && (
                <small className="muted">
                  Vlastníte {selectedHolding.quantity} ks.
                </small>
              )}
              <div className="order-total">
                <span>Odhadovaná hodnota</span>
                <b>
                  {money(
                    Number(quantity || 0) * Number(selected?.price ?? 0)
                  )}
                </b>
              </div>
              <div className="trade-buttons">
                <button
                  className="buy"
                  disabled={!canBuy}
                  onClick={() => trade("BUY")}
                >
                  Koupit
                </button>
                <button
                  className="sell"
                  disabled={!selectedHolding}
                  onClick={() => trade("SELL")}
                >
                  Prodat
                </button>
              </div>
              <small className="muted">
                Prodej probíhá pouze po celých kusech a nejvýše do vlastněného
                množství.
              </small>
            </section>
          </div>
        )}

        {(page === "overview" || page === "portfolio") && (
          <Holdings holdings={portfolio.holdings} />
        )}
        {(page === "overview" || page === "history") && (
          <Trades trades={portfolio.trades} />
        )}
      </main>

      {/* Modal Potvrzení obchodu */}
      {tradeConfirmation && selected && (
        <div
          className="modal-backdrop"
          onClick={() => setTradeConfirmation(null)}
        >
          <section
            className="detail-modal sell-confirm-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setTradeConfirmation(null)}
            >
              ×
            </button>
            <p className="eyebrow">
              {tradeConfirmation === "BUY"
                ? "POTVRDIT NÁKUP"
                : "POTVRDIT PRODEJ"}
            </p>
            <h2>
              {tradeConfirmation === "BUY"
                ? `Koupit akcie ${selected.symbol}?`
                : `Prodat akcie ${selected.symbol}?`}
            </h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>AKTIVUM</th>
                    <th>KS</th>
                    <th>
                      {tradeConfirmation === "BUY"
                        ? "NÁKUPNÍ HODNOTA"
                        : "PRŮMĚRNÁ NÁKUPNÍ CENA"}
                    </th>
                    {tradeConfirmation === "SELL" && <th>AKTUÁLNÍ CENA</th>}
                    <th>ODHADOVANÁ HODNOTA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <b>{selected.symbol}</b>
                      <small>{selected.name}</small>
                    </td>
                    <td>{quantity}</td>
                    <td>
                      {tradeConfirmation === "BUY"
                        ? money(selected.price ?? 0)
                        : money(selectedHolding?.average_price ?? 0)}
                    </td>
                    {tradeConfirmation === "SELL" && (
                      <td>{money(selected.price ?? 0)}</td>
                    )}
                    <td>{money(estimatedTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="muted">
              {tradeConfirmation === "BUY"
                ? "Opravdu chcete tento nákup provést?"
                : "Opravdu chcete tuto pozici prodat za aktuální tržní cenu?"}
            </p>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setTradeConfirmation(null)}
              >
                Zrušit
              </button>
              <button
                className="sell-all-confirm"
                onClick={confirmTrade}
              >
                {tradeConfirmation === "BUY"
                  ? "Opravdu zakoupit"
                  : "Potvrdit prodej"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal Reset Portfolia */}
      {showResetModal && (
        <div className="modal-backdrop" onClick={() => setShowResetModal(false)}>
          <section className="detail-modal account-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowResetModal(false)}>×</button>
            <p className="eyebrow">RESET PORTFOLIA</p>
            <h2>Opravdu resetovat portfolio?</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>AKCE</th><th>STAV</th><th>VÝSLEDEK</th></tr></thead>
                <tbody><tr>
                  <td><b>Reset portfolia</b></td>
                  <td>{portfolio.holdings.length} aktiv v portfoliu</td>
                  <td>Hotovost 100 000 Kč</td>
                </tr></tbody>
              </table>
            </div>
            <p className="muted">Smažou se všechny pozice i historie transakcí.</p>
            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowResetModal(false)}>Zrušit</button>
              <button className="sell-all-confirm" onClick={handleResetPortfolio}>
                Opravdu resetovat
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal Odhlášení */}
      {showLogoutModal && (
        <div className="modal-backdrop" onClick={() => setShowLogoutModal(false)}>
          <section className="detail-modal account-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowLogoutModal(false)}>×</button>
            <p className="eyebrow">ODHLÁŠENÍ</p>
            <h2>Opravdu se odhlásit?</h2>
            <div className="table-wrap">
            </div>
            <p className="muted">Po odhlášení se zobrazí přihlašovací obrazovka.</p>
            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowLogoutModal(false)}>Zrušit</button>
              <button className="primary-button" onClick={handleLogout}>
                Opravdu odhlásit
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal Prodat vše */}
      {showSellAll && (
        <div className="modal-backdrop" onClick={() => setShowSellAll(false)}>
          <section
            className="detail-modal sell-all-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowSellAll(false)}
            >
              ×
            </button>
            <p className="eyebrow">PRODAT VŠE</p>
            <h2>Kontrola pozic před prodejem</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>AKTIVUM</th>
                    <th>KS</th>
                    <th>PRŮMĚRNÁ NÁKUPNÍ CENA</th>
                    <th>NÁKUPNÍ HODNOTA</th>
                    <th>AKTUÁLNÍ CENA</th>
                    <th>VÝNOS</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.holdings.map((holding) => (
                    <tr key={holding.symbol}>
                      <td>
                        <b>{holding.symbol}</b>
                        <small>{holding.company_name}</small>
                      </td>
                      <td>{holding.quantity}</td>
                      <td>{money(holding.average_price)}</td>
                      <td>
                        {money(
                          Number(holding.quantity) *
                            Number(holding.average_price)
                        )}
                      </td>
                      <td>{money(holding.current_price)}</td>
                      <td
                        className={
                          Number(holding.profit) >= 0 ? "positive" : "negative"
                        }
                      >
                        {money(holding.profit)}
                        <small>{percent(holding.profit_percent)}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setShowSellAll(false)}
              >
                Zrušit
              </button>
              <button className="sell-all-confirm" onClick={sellAll}>
                Prodat všechny pozice
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal Detail akcie */}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            className="detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setDetail(null)}>
              ×
            </button>
            <p className="eyebrow">DETAIL AKCIE</p>
            <h2>
              {detail.quote.symbol} <span>{detail.quote.name}</span>
            </h2>
            <div className="detail-price">
              {money(detail.quote.price ?? 0)}{" "}
              <span
                className={
                  Number(detail.quote.change_percent ?? 0) >= 0
                    ? "positive"
                    : "negative"
                }
              >
                {percent(detail.quote.change_percent ?? 0)}
              </span>
            </div>
            <h3>Historie ceny — posledních 30 dní</h3>
            {detail.history.length ? (
              <div className="history-chart">
                {detail.history.map((point) => (
                  <span
                    key={point.time}
                    style={{
                      height: `${Math.max(
                        8,
                        (point.close /
                          Math.max(
                            ...detail.history.map((item) => item.close)
                          )) *
                          100
                      )}%`,
                    }}
                    title={`${new Date(
                      point.time * 1000
                    ).toLocaleDateString("cs-CZ")}: ${money(point.close)}`}
                  />
                ))}
              </div>
            ) : (
              <p className="muted">
                Historická data pro tento titul nejsou ve vašem tarifu Finnhub
                dostupná.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Holdings({ holdings }: { holdings: Holding[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PŘEHLED</p>
          <h2>Vaše portfolio</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>AKTIVUM</th>
              <th>POZICE</th>
              <th>PRŮMĚRNÁ CENA</th>
              <th>AKTUÁLNÍ CENA</th>
              <th>HODNOTA</th>
              <th>VÝNOS</th>
            </tr>
          </thead>
          <tbody>
            {holdings.length ? (
              holdings.map((holding) => (
                <tr key={holding.symbol}>
                  <td>
                    <b>{holding.symbol}</b>
                    <small>{holding.company_name}</small>
                  </td>
                  <td>{holding.quantity} ks</td>
                  <td>{money(holding.average_price)}</td>
                  <td>{money(holding.current_price)}</td>
                  <td>{money(holding.market_value)}</td>
                  <td
                    className={
                      Number(holding.profit) >= 0 ? "positive" : "negative"
                    }
                  >
                    {money(holding.profit)}
                    <small>{percent(holding.profit_percent)}</small>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="empty">
                  Zatím nemáte žádné pozice.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Trades({ trades }: { trades: Trade[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">HISTORIE</p>
          <h2>Poslední transakce</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>DATUM</th>
              <th>AKTIVUM</th>
              <th>TYP</th>
              <th>MNOŽSTVÍ</th>
              <th>CENA</th>
              <th>CELKEM</th>
            </tr>
          </thead>
          <tbody>
            {trades.length ? (
              trades.map((trade) => (
                <tr key={trade.id}>
                  <td>
                    {new Date(trade.executed_at).toLocaleDateString("cs-CZ")}
                  </td>
                  <td>
                    <b>{trade.symbol}</b>
                  </td>
                  <td>
                    <span className={`side ${trade.side.toLowerCase()}`}>
                      {trade.side === "BUY" ? "Nákup" : "Prodej"}
                    </span>
                  </td>
                  <td>{trade.quantity} ks</td>
                  <td>{money(trade.price)}</td>
                  <td>{money(trade.total)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="empty">
                  Historie obchodů je zatím prázdná.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default App;