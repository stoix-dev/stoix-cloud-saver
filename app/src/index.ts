import { buildServer } from "./server.js";
import { readEnvironment } from "./environment.js";

const port = Number(process.env.PORT ?? 8080);
const host = "0.0.0.0";

const app = buildServer();

async function start(): Promise<void> {
  try {
    await app.listen({ port, host });
    const env = readEnvironment();
    console.log(
      `stoix-cloud-saver listening on http://${host}:${port} ` +
        `[cloud=${env.cloud} region=${env.region} version=${env.version} commit=${env.commit}]`,
    );
  } catch (err) {
    console.error("failed to start server", err);
    process.exit(1);
  }
}

/**
 * Kubernetes sends SIGTERM on pod termination and expects the process to drain
 * in-flight requests and exit cleanly. Close the server once, on either signal.
 */
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`received ${signal}, shutting down`);
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    console.error("error during shutdown", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start();
