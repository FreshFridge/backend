import { poolPromise, sql } from "../../db/mssql";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  locale: string;
  timezone: string;
  is_active: boolean;
  role: string;
  is_blocked: boolean;
  blocked_at: Date | null;
  created_at: Date;
};

export class AuthRepository {
  async findByEmail(email: string): Promise<UserRow | null> {
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input("email", sql.NVarChar(255), email)
      .query("SELECT TOP 1 * FROM Users WHERE email = @email");

    return (res.recordset[0] as UserRow) ?? null;
  }

  async createUser(data: {
    email: string;
    password_hash: string;
    full_name: string;
    locale: string;
    timezone: string;
  }): Promise<Pick<UserRow, "id" | "email" | "full_name" | "locale" | "timezone" | "is_active" | "created_at">> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("email", sql.NVarChar(255), data.email)
      .input("password_hash", sql.NVarChar(255), data.password_hash)
      .input("full_name", sql.NVarChar(255), data.full_name)
      .input("locale", sql.NVarChar(50), data.locale)
      .input("timezone", sql.NVarChar(50), data.timezone)
      .query(`
        INSERT INTO Users (id, email, password_hash, full_name, locale, timezone, is_active, created_at)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.full_name, INSERTED.locale, INSERTED.timezone, INSERTED.is_active, INSERTED.created_at
        VALUES (NEWID(), @email, @password_hash, @full_name, @locale, @timezone, 1, SYSDATETIME())
      `);

    return res.recordset[0];
  }
}
