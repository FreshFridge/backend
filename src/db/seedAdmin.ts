import bcrypt from "bcrypt";
import sql from "mssql";
import { logger } from "../utils/logger";

const DEFAULT_ADMIN_EMAIL = "admin@freshfridge.com";
const DEFAULT_ADMIN_PASSWORD = "Admin123!";
const DEFAULT_ADMIN_NAME = "Administrator";

function getAdminSeedConfig() {
  const email = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).trim();
  const password = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  const fullName = (process.env.ADMIN_NAME ?? DEFAULT_ADMIN_NAME).trim() || DEFAULT_ADMIN_NAME;

  if (!email) {
    throw new Error("ADMIN_EMAIL must not be empty");
  }

  if (!password) {
    throw new Error("ADMIN_PASSWORD must not be empty");
  }

  return { email, password, fullName };
}

export async function seedAdminUser(pool: sql.ConnectionPool): Promise<void> {
  const { email, password, fullName } = getAdminSeedConfig();
  const existing = await pool
    .request()
    .input("email", sql.NVarChar(255), email)
    .query<{ password_hash: string }>("SELECT TOP 1 password_hash FROM Users WHERE email = @email");

  const existingPasswordHash = existing.recordset[0]?.password_hash;
  const passwordHash =
    existingPasswordHash && (await bcrypt.compare(password, existingPasswordHash))
      ? existingPasswordHash
      : await bcrypt.hash(password, 10);

  await pool
    .request()
    .input("email", sql.NVarChar(255), email)
    .input("password_hash", sql.NVarChar(255), passwordHash)
    .input("full_name", sql.NVarChar(255), fullName)
    .query(`
      MERGE Users WITH (HOLDLOCK) AS target
      USING (SELECT @email AS email) AS source
      ON target.email = source.email
      WHEN MATCHED AND (
        target.password_hash <> @password_hash OR
        target.full_name <> @full_name OR
        target.locale IS NULL OR
        target.locale = '' OR
        target.timezone IS NULL OR
        target.timezone = '' OR
        target.is_active <> 1 OR
        target.role <> 'admin' OR
        target.is_blocked <> 0 OR
        target.blocked_at IS NOT NULL
      ) THEN
        UPDATE SET
          password_hash = @password_hash,
          full_name = @full_name,
          locale = COALESCE(NULLIF(target.locale, ''), 'uk-UA'),
          timezone = COALESCE(NULLIF(target.timezone, ''), 'Europe/Kyiv'),
          is_active = 1,
          role = 'admin',
          is_blocked = 0,
          blocked_at = NULL,
          updated_at = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (
          id, email, password_hash, full_name, locale, timezone,
          is_active, role, is_blocked, blocked_at, created_at, updated_at
        )
        VALUES (
          NEWID(), @email, @password_hash, @full_name, 'uk-UA', 'Europe/Kyiv',
          1, 'admin', 0, NULL, SYSDATETIME(), SYSDATETIME()
        );
    `);

  logger.info("Admin seed ensured", { email });
}
