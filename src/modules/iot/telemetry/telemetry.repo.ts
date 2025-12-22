import { poolPromise, sql } from "../../../db/mssql";

export type TelemetryRow = {
  id: string;
  fridge_id: string;
  temperature: number;
  humidity: number | null;
  door_open: boolean;
  recorded_at: Date;
  created_at: Date;
};

export type ThresholdRow = {
  id: string;
  min_temperature: number;
  max_temperature: number;
  min_humidity: number | null;
  max_humidity: number | null;
  max_door_open_seconds: number;
  created_at: Date;
  is_active: boolean;
};

export class TelemetryRepository {
  async createTelemetryRecord(data: {
    fridge_id: string;
    temperature: number;
    humidity?: number | null;
    door_open: boolean;
  }): Promise<TelemetryRow> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("fridge_id", sql.UniqueIdentifier, data.fridge_id)
      .input("temperature", sql.Decimal(5, 2), data.temperature)
      .input("humidity", sql.Decimal(5, 2), data.humidity ?? null)
      .input("door_open", sql.Bit, data.door_open ? 1 : 0)
      .query(`
        DECLARE @new_id UNIQUEIDENTIFIER = NEWID();

        INSERT INTO FridgeTelemetry (
          id, fridge_id, temperature, humidity, door_open, recorded_at, created_at
        )
        VALUES (
          @new_id, @fridge_id, @temperature, @humidity, @door_open, SYSDATETIME(), SYSDATETIME()
        );

        SELECT * FROM FridgeTelemetry WHERE id = @new_id;
      `);

    return res.recordset[0];
  }

  async listTelemetry(fridgeId: string, query: { limit: number; offset: number }): Promise<TelemetryRow[]> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("fridge_id", sql.UniqueIdentifier, fridgeId)
      .input("limit", sql.Int, query.limit)
      .input("offset", sql.Int, query.offset)
      .query(`
        SELECT *
        FROM FridgeTelemetry
        WHERE fridge_id = @fridge_id
        ORDER BY recorded_at DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    return res.recordset as TelemetryRow[];
  }

  async getLatestTelemetry(fridgeId: string): Promise<TelemetryRow | null> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("fridge_id", sql.UniqueIdentifier, fridgeId)
      .query(`
        SELECT TOP 1 *
        FROM FridgeTelemetry
        WHERE fridge_id = @fridge_id
        ORDER BY recorded_at DESC
      `);

    return res.recordset[0] ?? null;
  }

  async getActiveThreshold(): Promise<ThresholdRow | null> {
    const pool = await poolPromise;

    const res = await pool.request().query(`
      SELECT TOP 1 *
      FROM TelemetryThresholds
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);

    return res.recordset[0] ?? null;
  }

  async checkRecentAlert(fridgeId: string, alertType: string, minutesAgo: number): Promise<boolean> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("fridge_id", sql.UniqueIdentifier, fridgeId)
      .input("alert_type", sql.NVarChar(50), alertType)
      .input("minutes_ago", sql.Int, minutesAgo)
      .query(`
        SELECT TOP 1 id
        FROM UserNotifications
        WHERE related_entity_id = @fridge_id
          AND type = @alert_type
          AND is_deleted = 0
          AND created_at > DATEADD(minute, -@minutes_ago, SYSDATETIME())
      `);

    return res.recordset.length > 0;
  }
}
