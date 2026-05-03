import { poolPromise, sql } from "../../db/mssql";

export type UserRow = {
  id: string;
  email: string;
  full_name: string;
  locale: string;
  timezone: string;
  is_active: boolean;
  role: string;
  is_blocked: boolean;
  blocked_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type SystemSettingsRow = {
  id: string;
  expiring_soon_days: number;
  notification_cooldown_hours: number;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
};

export type TelemetryThresholdRow = {
  id: string;
  min_temperature: number;
  max_temperature: number;
  min_humidity: number | null;
  max_humidity: number | null;
  max_door_open_seconds: number;
  created_at: Date;
  is_active: boolean;
};

export type AuditLogRow = {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id: string | null;
  details: string | null;
  created_at: Date;
};

export class AdminRepository {
  async listUsers(filters: {
    limit: number;
    offset: number;
    role?: string;
    is_blocked?: boolean;
  }): Promise<{ users: UserRow[]; total: number }> {
    const pool = await poolPromise;
    const req = pool.request();
    const countReq = pool.request();

    let whereClause = "1 = 1";
    if (filters.role) {
      whereClause += " AND role = @role";
      req.input("role", sql.NVarChar(20), filters.role);
      countReq.input("role", sql.NVarChar(20), filters.role);
    }

    if (filters.is_blocked !== undefined) {
      whereClause += " AND is_blocked = @is_blocked";
      req.input("is_blocked", sql.Bit, filters.is_blocked);
      countReq.input("is_blocked", sql.Bit, filters.is_blocked);
    }

    req.input("limit", sql.Int, filters.limit);
    req.input("offset", sql.Int, filters.offset);

    const [usersRes, countRes] = await Promise.all([
      req.query(`
        SELECT id, email, full_name, locale, timezone, is_active, role, is_blocked, blocked_at, created_at, updated_at
        FROM Users
        WHERE ${whereClause}
        ORDER BY created_at DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `),
      countReq.query(`SELECT COUNT(*) as total FROM Users WHERE ${whereClause}`),
    ]);

    return {
      users: usersRes.recordset as UserRow[],
      total: countRes.recordset[0].total,
    };
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query(`
        SELECT id, email, full_name, locale, timezone, is_active, role, is_blocked, blocked_at, created_at, updated_at
        FROM Users
        WHERE id = @id
      `);

    return (res.recordset[0] as UserRow) ?? null;
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("role", sql.NVarChar(20), role)
      .query(`
        UPDATE Users
        SET role = @role
        WHERE id = @id
      `);
  }

  async updateUserBlockStatus(id: string, is_blocked: boolean): Promise<void> {
    const pool = await poolPromise;
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("is_blocked", sql.Bit, is_blocked)
      .input("blocked_at", sql.DateTime2, is_blocked ? new Date() : null)
      .query(`
        UPDATE Users
        SET is_blocked = @is_blocked, blocked_at = @blocked_at
        WHERE id = @id
      `);
  }

  async getActiveSystemSettings(): Promise<SystemSettingsRow | null> {
    const pool = await poolPromise;
    const res = await pool.request().query(`
      SELECT TOP 1 id, expiring_soon_days, notification_cooldown_hours, created_at, updated_at, is_active
      FROM SystemSettings
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);

    return (res.recordset[0] as SystemSettingsRow) ?? null;
  }

  async getActiveTelemetryThreshold(): Promise<TelemetryThresholdRow | null> {
    const pool = await poolPromise;
    const res = await pool.request().query(`
      SELECT TOP 1 id, min_temperature, max_temperature, min_humidity, max_humidity, max_door_open_seconds, created_at, is_active
      FROM TelemetryThresholds
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);

    return (res.recordset[0] as TelemetryThresholdRow) ?? null;
  }

  async updateSystemSettings(settings: {
    expiring_soon_days?: number;
    notification_cooldown_hours?: number;
  }): Promise<void> {
    const pool = await poolPromise;
    const req = pool.request();

    const fields: string[] = [];

    if (settings.expiring_soon_days !== undefined) {
      fields.push("expiring_soon_days = @expiring_soon_days");
      req.input("expiring_soon_days", sql.Int, settings.expiring_soon_days);
    }

    if (settings.notification_cooldown_hours !== undefined) {
      fields.push("notification_cooldown_hours = @notification_cooldown_hours");
      req.input("notification_cooldown_hours", sql.Int, settings.notification_cooldown_hours);
    }

    if (fields.length === 0) return;

    await req.query(`
      UPDATE SystemSettings
      SET ${fields.join(", ")}
      WHERE is_active = 1
    `);
  }

  async updateTelemetryThreshold(threshold: {
    min_temperature?: number;
    max_temperature?: number;
    min_humidity?: number | null;
    max_humidity?: number | null;
    max_door_open_seconds?: number;
  }): Promise<void> {
    const pool = await poolPromise;
    const req = pool.request();

    const fields: string[] = [];

    if (threshold.min_temperature !== undefined) {
      fields.push("min_temperature = @min_temperature");
      req.input("min_temperature", sql.Decimal(5, 2), threshold.min_temperature);
    }

    if (threshold.max_temperature !== undefined) {
      fields.push("max_temperature = @max_temperature");
      req.input("max_temperature", sql.Decimal(5, 2), threshold.max_temperature);
    }

    if (threshold.min_humidity !== undefined) {
      fields.push("min_humidity = @min_humidity");
      req.input("min_humidity", sql.Decimal(5, 2), threshold.min_humidity);
    }

    if (threshold.max_humidity !== undefined) {
      fields.push("max_humidity = @max_humidity");
      req.input("max_humidity", sql.Decimal(5, 2), threshold.max_humidity);
    }

    if (threshold.max_door_open_seconds !== undefined) {
      fields.push("max_door_open_seconds = @max_door_open_seconds");
      req.input("max_door_open_seconds", sql.Int, threshold.max_door_open_seconds);
    }

    if (fields.length === 0) return;

    await req.query(`
      UPDATE TelemetryThresholds
      SET ${fields.join(", ")}
      WHERE is_active = 1
    `);
  }

  async createAuditLog(log: {
    admin_user_id: string;
    action: string;
    target_user_id?: string | null;
    details?: string | null;
  }): Promise<AuditLogRow> {
    const pool = await poolPromise;
    const res = await pool
      .request()
      .input("admin_user_id", sql.UniqueIdentifier, log.admin_user_id)
      .input("action", sql.NVarChar(50), log.action)
      .input("target_user_id", sql.UniqueIdentifier, log.target_user_id ?? null)
      .input("details", sql.NVarChar(1000), log.details ?? null)
      .query(`
        INSERT INTO AdminAuditLog (id, admin_user_id, action, target_user_id, details, created_at)
        OUTPUT INSERTED.id, INSERTED.admin_user_id, INSERTED.action, INSERTED.target_user_id, INSERTED.details, INSERTED.created_at
        VALUES (NEWID(), @admin_user_id, @action, @target_user_id, @details, SYSDATETIME())
      `);

    return res.recordset[0] as AuditLogRow;
  }

  async listAuditLogs(filters: {
    limit: number;
    offset: number;
    admin_user_id?: string;
    target_user_id?: string;
    action?: string;
  }): Promise<{ logs: AuditLogRow[]; total: number }> {
    const pool = await poolPromise;
    const req = pool.request();

    let whereClause = "1 = 1";

    if (filters.admin_user_id) {
      whereClause += " AND admin_user_id = @admin_user_id";
      req.input("admin_user_id", sql.UniqueIdentifier, filters.admin_user_id);
    }

    if (filters.target_user_id) {
      whereClause += " AND target_user_id = @target_user_id";
      req.input("target_user_id", sql.UniqueIdentifier, filters.target_user_id);
    }

    if (filters.action) {
      whereClause += " AND action = @action";
      req.input("action", sql.NVarChar(50), filters.action);
    }

    req.input("limit", sql.Int, filters.limit);
    req.input("offset", sql.Int, filters.offset);

    const [logsRes, countRes] = await Promise.all([
      req.query(`
        SELECT id, admin_user_id, action, target_user_id, details, created_at
        FROM AdminAuditLog
        WHERE ${whereClause}
        ORDER BY created_at DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `),
      pool
        .request()
        .input("admin_user_id", sql.UniqueIdentifier, filters.admin_user_id)
        .input("target_user_id", sql.UniqueIdentifier, filters.target_user_id)
        .input("action", sql.NVarChar(50), filters.action)
        .query(`SELECT COUNT(*) as total FROM AdminAuditLog WHERE ${whereClause}`),
    ]);

    return {
      logs: logsRes.recordset as AuditLogRow[],
      total: countRes.recordset[0].total,
    };
  }
}
