/**
 * Cloud identity reader.
 *
 * The whole point of this app is that the same container runs identically on
 * AWS, DigitalOcean and OCI, and reports which cloud it is on. That identity
 * comes 100% from environment variables injected by the infra layer, never
 * hardcoded. This module is the single place that reads them.
 */

export interface CloudEnvironment {
  cloud: string;
  region: string;
  version: string;
  commit: string;
  startedAt: string;
}

/**
 * Process start time, captured once at module load. Reported as uptime origin
 * and as a stable "startedAt" marker for every request in this process.
 */
const STARTED_AT = new Date().toISOString();

/**
 * Read the cloud identity from an environment-like source (defaults to
 * process.env). Pure and stateless apart from the module-load STARTED_AT.
 */
export function readEnvironment(
  source: Record<string, string | undefined> = process.env,
): CloudEnvironment {
  return {
    cloud: source.CLOUD_PROVIDER ?? "local",
    region: source.CLOUD_REGION ?? "local",
    version: source.APP_VERSION ?? "dev",
    commit: source.GIT_COMMIT ?? "unknown",
    startedAt: STARTED_AT,
  };
}
