import { poolPromise, sql } from "../../db/mssql";

export type FridgeRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: boolean;
};

export class FridgesRepository {
  async create(userId: string, dto: { name: string; description?: string | null }): Promise<FridgeRow> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("name", sql.NVarChar(255), dto.name)
      .input("description", sql.NVarChar(500), dto.description ?? null)
      .query(`
        INSERT INTO Fridges (id, user_id, name, description, created_at, updated_at, is_deleted)
        OUTPUT INSERTED.*
        VALUES (NEWID(), @user_id, @name, @description, SYSDATETIME(), SYSDATETIME(), 0)
      `);

    return res.recordset[0];
  }

  async findById(id: string): Promise<FridgeRow | null> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("SELECT TOP 1 * FROM Fridges WHERE id = @id AND is_deleted = 0");

    return res.recordset[0] ?? null;
  }

  async listByUser(userId: string): Promise<FridgeRow[]> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .query(`
        SELECT *
        FROM Fridges
        WHERE user_id = @user_id AND is_deleted = 0
        ORDER BY created_at DESC
      `);

    return res.recordset as FridgeRow[];
  }

  async update(id: string, patch: { name?: string; description?: string | null }): Promise<FridgeRow> {
    const pool = await poolPromise;

    const fields: string[] = [];
    const req = pool.request().input("id", sql.UniqueIdentifier, id);

    if ("name" in patch && patch.name !== undefined) {
      fields.push("name = @name");
      req.input("name", sql.NVarChar(255), patch.name);
    }
    if ("description" in patch) {
      fields.push("description = @description");
      req.input("description", sql.NVarChar(500), patch.description ?? null);
    }

    if (fields.length === 0) {
      const current = await this.findById(id);
      if (!current) throw new Error("Fridge not found");
      return current;
    }

    await req.query(`
      UPDATE Fridges
      SET ${fields.join(", ")}
      WHERE id = @id AND is_deleted = 0
    `);

    const updated = await this.findById(id);
    if (!updated) throw new Error("Fridge not found");
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("UPDATE Fridges SET is_deleted = 1, updated_at = SYSDATETIME() WHERE id = @id");
  }

  async softDeleteWithContents(id: string): Promise<void> {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
      const request = new sql.Request(transaction).input("id", sql.UniqueIdentifier, id);

      await request.query(`
        UPDATE Products
        SET status = 'removed',
            fridge_id = NULL,
            shelf_id = NULL
        WHERE fridge_id = @id
           OR shelf_id IN (SELECT id FROM Shelves WHERE fridge_id = @id);

        UPDATE Shelves
        SET is_deleted = 1, updated_at = SYSDATETIME()
        WHERE fridge_id = @id;

        IF OBJECT_ID('IoTDevices', 'U') IS NOT NULL
        BEGIN
          UPDATE IoTDevices
          SET is_active = 0, updated_at = SYSDATETIME()
          WHERE fridge_id = @id;
        END

        UPDATE Fridges
        SET is_deleted = 1, updated_at = SYSDATETIME()
        WHERE id = @id;
      `);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async hasShelvesOrProducts(fridgeId: string): Promise<boolean> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("fridge_id", sql.UniqueIdentifier, fridgeId)
      .query(`
        SELECT
          CASE
            WHEN EXISTS (SELECT 1 FROM Shelves WHERE fridge_id = @fridge_id AND is_deleted = 0)
              OR EXISTS (SELECT 1 FROM Products WHERE fridge_id = @fridge_id)
            THEN 1
            ELSE 0
          END AS has_data
      `);

    return res.recordset[0].has_data === 1;
  }
}


