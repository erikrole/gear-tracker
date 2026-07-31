CREATE TYPE "PasskeyCeremonyType" AS ENUM (
  'REGISTRATION',
  'AUTHENTICATION'
);

CREATE TABLE "passkey_credentials" (
  "id" TEXT NOT NULL,
  "credential_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "public_key" BYTEA NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "device_type" TEXT,
  "backed_up" BOOLEAN NOT NULL DEFAULT false,
  "name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3),

  CONSTRAINT "passkey_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "passkey_challenges" (
  "id" TEXT NOT NULL,
  "ceremony_token_hash" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "type" "PasskeyCeremonyType" NOT NULL,
  "user_id" TEXT,
  "remember_me" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "passkey_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "passkey_credentials_credential_id_key"
  ON "passkey_credentials"("credential_id");
CREATE INDEX "passkey_credentials_user_id_idx"
  ON "passkey_credentials"("user_id");

CREATE UNIQUE INDEX "passkey_challenges_ceremony_token_hash_key"
  ON "passkey_challenges"("ceremony_token_hash");
CREATE UNIQUE INDEX "passkey_challenges_challenge_key"
  ON "passkey_challenges"("challenge");
CREATE INDEX "passkey_challenges_user_id_type_idx"
  ON "passkey_challenges"("user_id", "type");
CREATE INDEX "passkey_challenges_expires_at_idx"
  ON "passkey_challenges"("expires_at");

ALTER TABLE "passkey_credentials"
  ADD CONSTRAINT "passkey_credentials_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "passkey_challenges"
  ADD CONSTRAINT "passkey_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
