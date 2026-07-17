import { buildServer } from "./server.js";
import { readEnvironment } from "./environment.js";

const host = "0.0.0.0";
const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = buildServer();

/**
 * Resolve the listen port, failing fast on a non-numeric or out-of-range PORT
 * so we get a clear message at startup instead of a late NaN listen error.
 */
function resolvePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return 8080;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    app.log.fatal(`invalid PORT "${raw}": expected an integer in 1..65535`);
    process.exit(1);
  }
  return port;
}

async function start(): Promise<void> {
  const port = resolvePort(process.env.PORT);
  try {
    await app.listen({ port, host });
    const env = readEnvironment();
    app.log.info(
      { cloud: env.cloud, region: env.region, version: env.version, commit: env.commit },
      `stoix-cloud-saver listening on http://${host}:${port}`,
    );
  } catch (err) {
    app.log.fatal(err, "failed to start server");
    process.exit(1);
  }
}

/**
 * Kubernetes sends SIGTERM on pod termination and expects the process to drain
 * in-flight requests and exit cleanly. Close the server once, on either signal,
 * with a hard timeout so a hung close still exits.
 */
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`received ${signal}, shutting down`);

  const forceExit = setTimeout(() => {
    app.log.fatal("graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.fatal(err, "error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start();
