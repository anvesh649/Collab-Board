import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Logger } from "nestjs-pino";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { requestIdFrom } from "../src/http/request-id";

describe("requestIdFrom", () => {
  it.each([
    ["abc-123", "abc-123"],
    ["A".repeat(128), "A".repeat(128)],
  ])("reuses a valid incoming id %#", (header, expected) => {
    expect(requestIdFrom(header)).toBe(expected);
  });

  it.each([[undefined], [""], ["has space"], ["abc\n"], ["x".repeat(129)], ["<script>"]])(
    "replaces a missing or unsafe id with a fresh UUID %#",
    (header) => {
      expect(requestIdFrom(header)).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});

type Server = Parameters<typeof request>[0];

describe("HTTP pipeline", () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: inject("databaseUrl"),
      NODE_ENV: "test",
      ALLOWED_HOSTS: "collabboard.test",
      LOG_LEVEL: "fatal",
    });
    // Imported only now: ConfigModule.forRoot() reads the environment when AppModule is
    // first imported, so a top-level import would see the developer's .env instead.
    const { AppModule } = await import("../src/app.module.js");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it("echoes a valid X-Request-ID and generates one otherwise", async () => {
    const reused = await request(server).get("/").set("X-Request-ID", "abc-123");
    expect(reused.headers["x-request-id"]).toBe("abc-123");

    const fresh = await request(server).get("/").set("X-Request-ID", "bad id");
    expect(fresh.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("answers to an allowed host, ignoring the port", async () => {
    const res = await request(server).get("/").set("Host", "collabboard.test:3000");
    expect(res.status).toBe(404); // no routes yet, but the host was accepted
  });

  it("rejects any other Host header with a 400 problem response", async () => {
    const res = await request(server).get("/").set("Host", "evil.example");
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(res.headers["x-request-id"]).toBeDefined();
  });
});
