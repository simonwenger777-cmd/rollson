"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LanguageSwitcher, useLanguage } from "../lib/language";

type MailMessage = {
  id: string;
  subject?: string;
  receivedAt?: string;
  from?: string;
  code?: string;
  bodyPreview?: string;
  bodyHtml?: string;
  bodyText?: string;
};

type QueryResult = {
  ok: boolean;
  message?: string;
  email?: string;
  count?: number;
  cdKeyExpiresAt?: string;
  messages?: MailMessage[];
};

const BRAND = "Rollson";
const FUNPAY_URL = "https://funpay.com/users/16210908/";

function Header() {
  return (
    <header className="topbar has-centered-name">
      <a className="brand" href="/" aria-label={`${BRAND} home`}>
        <span className="brand-mark brand-mark-image">
          <img src="/brand-icon.png" alt={`${BRAND} icon`} width={32} height={32} />
        </span>
        <span className="brand-word">{BRAND}</span>
      </a>
      <div className="topbar-center-name" aria-label="Site brand">
        FunPay
      </div>
      <nav className="top-actions" aria-label="Primary navigation">
        <LanguageSwitcher />
      </nav>
    </header>
  );
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <p className="site-footer-text">
        © {new Date().getFullYear()} {t("common.rights")}{" "}
        <span className="footer-owner-link">{BRAND}</span>
      </p>
    </footer>
  );
}

function wrapHtml(html: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><base target="_blank"/><style>
    body{margin:16px;font-family:Inter,system-ui,sans-serif;background:#222;color:#ececec;word-break:break-word;}
    a{color:#bdbdbd}
    img{max-width:100%;height:auto}
  </style></head><body>${html}</body></html>`;
}

export default function HomePage() {
  const { t } = useLanguage();
  const [cdKey, setCdKey] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMail, setOpenMail] = useState<Record<string, boolean>>({});
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const query = useCallback(
    async (key: string, mode: "open" | "poll") => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (mode === "open") {
        setOpening(true);
        setResult(null);
        setCopiedId(null);
        setOpenMail({});
      } else {
        setPolling(true);
      }
      try {
        const response = await fetch("/api/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cdKey: key }),
          cache: "no-store",
          signal: AbortSignal.timeout(50000),
        });
        const data = (await response.json()) as QueryResult;
        setResult(data);
        setLastChecked(new Date());
        if (data.ok) setActiveKey(key);
        else if (mode === "open") setActiveKey(null);
      } catch {
        if (mode === "open") {
          setResult({ ok: false, message: t("main.networkError") });
          setActiveKey(null);
        }
      } finally {
        inFlight.current = false;
        setOpening(false);
        setPolling(false);
      }
    },
    [t]
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const key = cdKey.trim();
    if (key) await query(key, "open");
  }

  async function copyText(value: string, id: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement("textarea");
        area.value = value;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1600);
    } catch {
      alert(t("main.copyFailed"));
    }
  }

  useEffect(() => {
    if (!activeKey || !result?.ok) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void query(activeKey, "poll");
    }, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void query(activeKey, "poll");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeKey, result?.ok, query]);

  const hasMessages = !!(result && result.ok && result.messages?.length);
  const daysLeft =
    result && result.ok && result.cdKeyExpiresAt
      ? Math.max(0, Math.ceil((new Date(result.cdKeyExpiresAt).getTime() - Date.now()) / 86400000))
      : null;

  return (
    <main className="app-shell unified-2026-page">
      <Header />
      <section className="inbox-center container">
        <section className="mail-console inbox-console" id="inbox" aria-label="Mailbox query console">
          <div className="console-header console-header-centered">
            <div className="console-header-main">
              <a
                className="console-avatar-link"
                href={FUNPAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ROLLSON on FunPay"
              >
                <img className="console-avatar" src="/ROLLSON.png" alt="Rollson" width={80} height={80} />
              </a>
              <div className="console-header-text">
                <p className="label">{t("main.badge")}</p>
                <h1>
                  <a className="console-title-link" href={FUNPAY_URL} target="_blank" rel="noopener noreferrer">
                    {t("main.title")}
                  </a>
                </h1>
                <p className="console-intro">{t("main.intro")}</p>
              </div>
            </div>
          </div>

          <form className="mailbox-form" onSubmit={onSubmit}>
            <div className="email-input-wrap">
              <span className="input-icon">@</span>
              <input
                className="email-input"
                type="text"
                placeholder="MG-XXXXX-XXXXX-XXXXX-XXXXX"
                required
                value={cdKey}
                onChange={(event) => setCdKey(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button className="primary-btn" disabled={opening || !cdKey.trim()} type="submit">
              {opening ? t("main.checking") : t("main.openInbox")}
            </button>
          </form>

          {result && !result.ok ? (
            <div className="notice error" role="alert">
              {result.message || t("main.queryFailed")}
            </div>
          ) : null}

          {result?.ok ? (
            <div className="inbox-area">
              <div className="inbox-live-bar" aria-live="polite">
                <span className={`live-dot${polling ? " is-pulse" : ""}`} aria-hidden="true" />
                <span>
                  {polling ? t("main.autoRefreshing") : t("main.autoRefreshOn")}
                  {lastChecked ? ` · ${t("main.lastChecked", { time: lastChecked.toLocaleTimeString() })}` : ""}
                </span>
                <button
                  type="button"
                  className="live-refresh-btn"
                  disabled={polling || opening}
                  onClick={() => activeKey && void query(activeKey, "poll")}
                >
                  {t("main.refreshNow")}
                </button>
              </div>
              <div className="inbox-summary">
                <div>
                  <span className="label">{t("main.mailbox")}</span>
                  <strong>{result.email}</strong>
                </div>
                <div>
                  <span className="label">{t("main.messages")}</span>
                  <strong>{result.count}</strong>
                </div>
                <div>
                  <span className="label">{t("main.keyExpires")}</span>
                  <strong>
                    {result.cdKeyExpiresAt ? new Date(result.cdKeyExpiresAt).toLocaleDateString("en-US") : "—"}
                  </strong>
                </div>
                <div>
                  <span className="label">{t("main.daysLeft")}</span>
                  <strong>{daysLeft === null ? "—" : `${daysLeft} days`}</strong>
                </div>
              </div>
              {hasMessages ? (
                result.messages!.map((message) => (
                  <article className="message-card" key={message.id}>
                    <div className="message-topline">
                      <h3>{message.subject || "(no subject)"}</h3>
                      {message.receivedAt ? (
                        <time dateTime={message.receivedAt}>
                          {new Date(message.receivedAt).toLocaleString()}
                        </time>
                      ) : null}
                    </div>
                    {message.from ? <p className="sender">{message.from}</p> : null}
                    {message.code ? (
                      <div className="code-strip">
                        <div>
                          <span className="label">{t("main.verificationCode")}</span>
                          <strong className="code-value">{message.code}</strong>
                        </div>
                        <button
                          type="button"
                          className="copy-code-btn"
                          onClick={() => copyText(message.code!, message.id)}
                        >
                          {copiedId === message.id ? t("main.copied") : t("main.copy")}
                        </button>
                      </div>
                    ) : null}
                    <p className="message-preview">{message.bodyPreview || t("main.noBodyPreview")}</p>
                    <button
                      type="button"
                      className="full-email-toggle"
                      onClick={() =>
                        setOpenMail((current) => ({ ...current, [message.id]: !current[message.id] }))
                      }
                    >
                      {openMail[message.id] ? t("main.hideFullEmail") : t("main.viewFullEmail")}
                    </button>
                    {openMail[message.id] ? (
                      <div className="full-email-panel">
                        <p className="full-email-hint">{t("main.originalEmailHint")}</p>
                        <div className="full-email-view">
                          {message.bodyHtml ? (
                            <iframe
                              className="full-email-frame"
                              title={`Full email: ${message.subject || ""}`}
                              srcDoc={wrapHtml(message.bodyHtml)}
                              sandbox="allow-popups allow-popups-to-escape-sandbox"
                            />
                          ) : (
                            <pre className="full-email-body">
                              {message.bodyText || message.bodyPreview || t("main.noFullEmail")}
                            </pre>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="empty-state compact">
                  <div className="empty-icon">0</div>
                  <h3>{t("main.noRecentMail")}</h3>
                  <p>{t("main.noRecentMailText")}</p>
                  <p className="auto-wait-hint">{t("main.autoWaitHint")}</p>
                </div>
              )}
            </div>
          ) : result ? null : (
            <div className="empty-state">
              <div className="empty-icon">@</div>
              <h3>{t("main.ready")}</h3>
              <p>{t("main.readyText")}</p>
            </div>
          )}
        </section>
      </section>
      <Footer />
    </main>
  );
}
