import { describe, expect, it } from "vitest";
import { readEnvironment } from "../src/environment.js";

describe("readEnvironment", () => {
  it("reads cloud identity from environment variables", () => {
    const result = readEnvironment({
      CLOUD_PROVIDER: "oci",
      CLOUD_REGION: "us-ashburn-1",
      APP_VERSION: "1.2.3",
      GIT_COMMIT: "abc1234",
    });

    expect(result).toMatchObject({
      cloud: "oci",
      region: "us-ashburn-1",
      version: "1.2.3",
      commit: "abc1234",
    });
  });

  it("falls back to local defaults when nothing is set", () => {
    const result = readEnvironment({});

    expect(result).toMatchObject({
      cloud: "local",
      region: "local",
      version: "dev",
    });
  });

  it("defaults commit to unknown and exposes an ISO startedAt", () => {
    const result = readEnvironment({});

    expect(result.commit).toBe("unknown");
    expect(() => new Date(result.startedAt).toISOString()).not.toThrow();
    expect(result.startedAt).toBe(new Date(result.startedAt).toISOString());
  });
});
