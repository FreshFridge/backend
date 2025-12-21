import { poolPromise, sql } from "../../db/mssql";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  severity: string;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: boolean;
};

export class NotificationsRepository {
  async create(userId: string, dto: {
    type: string;
    title: string;
    message: string;
    related_entity_type?: string | null;
    related_entity_id?: string | null;
    severity: string;
  }): Promise<NotificationRow> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("type", sql.NVarChar(50), dto.type)
      .input("title", sql.NVarChar(200), dto.title)
      .input("message", sql.NVarChar(1000), dto.message)
      .input("related_entity_type", sql.NVarChar(50), dto.related_entity_type ?? null)
      .input("related_entity_id", sql.UniqueIdentifier, dto.related_entity_id ?? null)
      .input("severity", sql.NVarChar(20), dto.severity)
      .query(`
        DECLARE @new_id UNIQUEIDENTIFIER = NEWID();

        INSERT INTO UserNotifications (
          id, user_id, type, title, message,
          related_entity_type, related_entity_id, severity,
          is_read, read_at, created_at, updated_at, is_deleted
        )
        VALUES (
          @new_id, @user_id, @type, @title, @message,
          @related_entity_type, @related_entity_id, @severity,
          0, NULL, SYSDATETIME(), SYSDATETIME(), 0
        );

        SELECT id, user_id, type, title, message,
               related_entity_type, related_entity_id, severity,
               is_read, read_at, created_at, updated_at, is_deleted
        FROM UserNotifications WHERE id = @new_id;
      `);

    return res.recordset[0];
  }

  async findById(id: string): Promise<NotificationRow | null> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query(`
        SELECT TOP 1 id, user_id, type, title, message,
               related_entity_type, related_entity_id, severity,
               is_read, read_at, created_at, updated_at, is_deleted
        FROM UserNotifications
        WHERE id = @id AND is_deleted = 0
      `);

    return res.recordset[0] ?? null;
  }

  async list(userId: string, query: {
    isRead?: boolean;
    type?: string;
    limit: number;
    offset: number;
  }): Promise<NotificationRow[]> {
    const pool = await poolPromise;

    const conditions: string[] = ["user_id = @user_id", "is_deleted = 0"];
    const req = pool.request().input("user_id", sql.UniqueIdentifier, userId);

    if (query.isRead !== undefined) {
      conditions.push("is_read = @is_read");
      req.input("is_read", sql.Bit, query.isRead ? 1 : 0);
    }

    if (query.type) {
      conditions.push("type = @type");
      req.input("type", sql.NVarChar(50), query.type);
    }

    const whereSql = conditions.join(" AND ");

    req.input("limit", sql.Int, query.limit);
    req.input("offset", sql.Int, query.offset);

    const res = await req.query(`
      SELECT id, user_id, type, title, message,
             related_entity_type, related_entity_id, severity,
             is_read, read_at, created_at, updated_at, is_deleted
      FROM UserNotifications
      WHERE ${whereSql}
      ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return res.recordset as NotificationRow[];
  }

  async markRead(userId: string, id: string): Promise<NotificationRow> {
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("user_id", sql.UniqueIdentifier, userId)
      .query(`
        UPDATE UserNotifications
        SET is_read = 1, read_at = SYSDATETIME()
        WHERE id = @id AND user_id = @user_id AND is_deleted = 0
      `);

    const updated = await this.findById(id);
    if (!updated) throw new Error("Notification not found after update");
    return updated;
  }

  async markAllRead(userId: string): Promise<number> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .query(`
        UPDATE UserNotifications
        SET is_read = 1, read_at = SYSDATETIME()
        WHERE user_id = @user_id AND is_read = 0 AND is_deleted = 0;

        SELECT @@ROWCOUNT AS count;
      `);

    return res.recordset[0].count;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .input("user_id", sql.UniqueIdentifier, userId)
      .query(`
        UPDATE UserNotifications
        SET is_deleted = 1
        WHERE id = @id AND user_id = @user_id
      `);
  }
}
