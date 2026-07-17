import Fastify, { type FastifyInstance } from "fastify";
import { readEnvironment, type CloudEnvironment } from "./environment.js";

/**
 * Escape a value for safe interpolation into HTML text/attribute context.
 * Cloud identity comes from the environment, so it is trusted-ish, but we never
 * inject unescaped strings into markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render the single self-contained landing page. Inline CSS only, no external
 * assets, fonts or CDN, so it renders identically in any cluster and is
 * CSP-safe. Theme-aware via prefers-color-scheme.
 */
function renderPage(env: CloudEnvironment, uptimeSeconds: number): string {
  const cloud = escapeHtml(env.cloud);
  const region = escapeHtml(env.region);
  const version = escapeHtml(env.version);
  const commit = escapeHtml(env.commit);
  const startedAt = escapeHtml(env.startedAt);
  const uptime = escapeHtml(formatUptime(uptimeSeconds));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Stoix Cloud Saver</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f4f6fb;
    --panel: #ffffff;
    --border: #e2e8f0;
    --text: #0f172a;
    --muted: #64748b;
    --accent: #2563eb;
    --dot: #16a34a;
    --dot-glow: rgba(22, 163, 74, 0.35);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b1120;
      --panel: #111a2e;
      --border: #1e293b;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #60a5fa;
      --dot: #22c55e;
      --dot-glow: rgba(34, 197, 94, 0.4);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: var(--bg);
    color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .card {
    width: 100%;
    max-width: 560px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 2.5rem;
    box-shadow: 0 20px 60px -30px rgba(15, 23, 42, 0.45);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .brand {
    font-size: 0.8rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--dot);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--dot);
    box-shadow: 0 0 0 4px var(--dot-glow);
  }
  h1 {
    margin: 0 0 0.35rem;
    font-size: 2.1rem;
    line-height: 1.1;
  }
  .subtitle {
    margin: 0 0 2rem;
    color: var(--muted);
    font-size: 0.95rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  .cell {
    background: var(--panel);
    padding: 1rem 1.15rem;
  }
  .label {
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 0.35rem;
  }
  .value {
    font-size: 1.05rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    word-break: break-word;
  }
  .cloud .value { color: var(--accent); }
  footer {
    margin-top: 1.75rem;
    font-size: 0.75rem;
    color: var(--muted);
    text-align: center;
  }
  @media (max-width: 480px) {
    .grid { grid-template-columns: minmax(0, 1fr); }
  }
</style>
</head>
<body>
  <main class="card">
    <div class="head">
      <span class="brand">Stoix Cloud Saver</span>
      <span class="status"><span class="dot"></span>healthy</span>
    </div>
    <h1>Running on ${cloud}</h1>
    <p class="subtitle">One container, every cloud. This instance reports its identity live from the platform it was deployed to.</p>
    <div class="grid">
      <div class="cell cloud">
        <div class="label">Cloud</div>
        <div class="value">${cloud}</div>
      </div>
      <div class="cell">
        <div class="label">Region</div>
        <div class="value">${region}</div>
      </div>
      <div class="cell">
        <div class="label">Version</div>
        <div class="value">${version}</div>
      </div>
      <div class="cell">
        <div class="label">Commit</div>
        <div class="value">${commit}</div>
      </div>
      <div class="cell">
        <div class="label">Uptime</div>
        <div class="value">${uptime}</div>
      </div>
      <div class="cell">
        <div class="label">Started</div>
        <div class="value">${startedAt}</div>
      </div>
    </div>
    <footer>Stateless showcase &middot; AWS &middot; DigitalOcean &middot; OCI</footer>
  </main>
</body>
</html>`;
}

function formatUptime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

/**
 * Build a Fastify instance wired to a cloud-identity source. Passing an env
 * source keeps the server fully testable without touching process.env.
 */
export function buildServer(
  envSource: Record<string, string | undefined> = process.env,
): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/healthz", async () => {
    return { status: "ok", uptime: process.uptime() };
  });

  app.get("/api/info", async () => {
    return readEnvironment(envSource);
  });

  app.get("/", async (_request, reply) => {
    const env = readEnvironment(envSource);
    const html = renderPage(env, process.uptime());
    reply.header("content-type", "text/html; charset=utf-8");
    return reply.send(html);
  });

  return app;
}
