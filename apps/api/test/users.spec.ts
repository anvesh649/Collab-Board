import { ConfigService } from "@nestjs/config";
import { verify } from "argon2";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import {
  EmailRequiredError,
  EmailTakenError,
  InvalidSuperuserError,
  UsersService,
} from "../src/accounts/users.service";
import { DatabaseService } from "../src/database/database.service";

// The checks from the Django version, run against real PostgreSQL 18.
describe("UsersService", () => {
  let db: DatabaseService;
  let users: UsersService;

  beforeAll(async () => {
    const config = new ConfigService({ DATABASE_URL: inject("databaseUrl") });
    db = new DatabaseService(config as never);
    await db.onModuleInit();
    users = new UsersService(db);
  });

  beforeEach(async () => {
    await db.user.deleteMany();
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  it("stores the email trimmed and lowercased, with a UUIDv7 id", async () => {
    const user = await users.createUser({ email: "  Asha@Shop.COM ", password: "pw" });
    expect(user.email).toBe("asha@shop.com");
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("rejects a second account that differs only in case", async () => {
    await users.createUser({ email: "a@x.com" });
    await expect(users.createUser({ email: "A@X.com" })).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("the database rejects a non-normalised email even from raw SQL", async () => {
    await expect(
      db.$executeRaw`INSERT INTO users (email) VALUES ('Mixed@Case.com')`,
    ).rejects.toThrow(/users_email_normalized_check/);
  });

  it("finds a user whatever case the login form sends", async () => {
    const created = await users.createUser({ email: "asha@shop.com" });
    expect((await users.findByEmail("ASHA@shop.com "))?.id).toBe(created.id);
  });

  it("requires an email", async () => {
    await expect(users.createUser({ email: "   " })).rejects.toBeInstanceOf(EmailRequiredError);
  });

  it("hashes passwords with argon2id and never stores them in plain text", async () => {
    const user = await users.createUser({ email: "a@x.com", password: "hunter2" });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verify(user.passwordHash ?? "", "hunter2")).toBe(true);
  });

  it("creates an account that cannot log in with a password when none is given", async () => {
    const user = await users.createUser({ email: "sso@x.com" });
    expect(user.passwordHash).toBeNull();
  });

  it("makes superusers staff and superuser, and refuses an explicit false", async () => {
    const admin = await users.createSuperuser({ email: "root@x.com", password: "pw" });
    expect([admin.isStaff, admin.isSuperuser]).toEqual([true, true]);
    await expect(
      users.createSuperuser({ email: "b@x.com", isStaff: false }),
    ).rejects.toBeInstanceOf(InvalidSuperuserError);
  });

  it("regular users are neither staff nor superuser", async () => {
    const user = await users.createUser({ email: "u@x.com" });
    expect([user.isStaff, user.isSuperuser]).toEqual([false, false]);
  });
});
