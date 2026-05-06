import { poolPromise, sql } from "../../../db/mssql";

export type IotDeviceRow = {
  id: string;
  user_id: string;
  fridge_id: string;
  name: string;
  api_key_hash: string;
  api_key_prefix: string;
  is_active: boolean;
  last_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class IotDevicesRepository {
  async create(data: {
    user_id: string;
    fridge_id: string;
    name: string;
    api_key_hash: string;
    api_key_prefix: string;
  }): Promise<IotDeviceRow> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, data.user_id)
      .input("fridge_id", sql.UniqueIdentifier, data.fridge_id)
      .input("name", sql.NVarChar(255), data.name)
      .input("api_key_hash", sql.NVarChar(128), data.api_key_hash)
      .input("api_key_prefix", sql.NVarChar(32), data.api_key_prefix)
      .query(`
        INSERT INTO IoTDevices (
          id, user_id, fridge_id, name, api_key_hash, api_key_prefix,
          is_active, created_at, updated_at
        )
        OUTPUT INSERTED.*
        VALUES (
          NEWID(), @user_id, @fridge_id, @name, @api_key_hash, @api_key_prefix,
          1, SYSDATETIME(), SYSDATETIME()
        )
      `);

    return res.recordset[0];
  }

  async listByUser(userId: string): Promise<IotDeviceRow[]> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .query(`
        SELECT *
        FROM IoTDevices
        WHERE user_id = @user_id
        ORDER BY created_at DESC
      `);

    return res.recordset as IotDeviceRow[];
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<IotDeviceRow | null> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("api_key_hash", sql.NVarChar(128), apiKeyHash)
      .query(`
        SELECT TOP 1 *
        FROM IoTDevices
        WHERE api_key_hash = @api_key_hash
      `);

    return res.recordset[0] ?? null;
  }

  async touchLastUsed(id: string): Promise<void> {
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query(`
        UPDATE IoTDevices
        SET last_used_at = SYSDATETIME(), updated_at = SYSDATETIME()
        WHERE id = @id
      `);
  }
}