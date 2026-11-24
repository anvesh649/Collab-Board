-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT,
    "first_name" VARCHAR(150) NOT NULL DEFAULT '',
    "last_name" VARCHAR(150) NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Added by hand: the Prisma schema cannot express CHECK constraints.
-- Emails are stored trimmed and lowercased (UsersService.normalizeEmail). This rejects any
-- write that skips that code (raw SQL, scripts, a future bug), which makes the unique index
-- above effectively case-insensitive: "A@x.com" can never sit next to "a@x.com".
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized_check"
    CHECK ("email" = lower(btrim("email")) AND "email" <> '');
