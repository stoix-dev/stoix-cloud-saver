import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe("GET /healthz", () => {
  it("returns 200 with an ok status", async () => {
    app = buildServer();

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });
});

describe("GET /api/info", () => {
  it("reports the cloud identity from the injected env source", async () => {
    app = buildServer({
      CLOUD_PROVIDER: "aws",
      CLOUD_REGION: "us-east-1",
      APP_VERSION: "9.9.9",
    });

    const response = await app.inject({ method: "GET", url: "/api/info" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      cloud: "aws",
      region: "us-east-1",
      version: "9.9.9",
    });
  });
});

describe("GET /", () => {
  it("serves an HTML page naming the current cloud", async () => {
    app = buildServer({
      CLOUD_PROVIDER: "digitalocean",
      CLOUD_REGION: "sfo3",
    });

    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body.toLowerCase()).toContain("digitalocean");
  });
});
