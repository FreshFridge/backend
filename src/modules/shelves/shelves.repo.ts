import { poolPromise, sql } from "../../db/mssql";

export type ShelfRow = {
  id: string;
  fridge_id: string;
  name: string;
  position: number | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: boolean;
};

export class ShelvesRepository {
  async create(fridgeId: string, dto: { name: string; position?: number | null }): Promise<ShelfRow> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("fridge_id", sql.UniqueIdentifier, fridgeId)
      .input("name", sql.NVarChar(255), dto.name)
      .input("position_index", sql.Int, dto.position ?? null)
      .query(`
        INSERT INTO Shelves (id, fridge_id, name, position_index, created_at, updated_at, is_deleted)
        OUTPUT INSERTED.id, INSERTED.fridge_id, INSERTED.name, INSERTED.position_index AS position,
               INSERTED.created_at, INSERTED.updated_at, INSERTED.is_deleted
        VALUES (NEWID(), @fridge_id, @name, @position_index, SYSDATETIME(), SYSDATETIME(), 0)
      `);

    return res.recordset[0];
  }

  async findById(id: string): Promise<ShelfRow | null> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query(`
        SELECT TOP 1 id, fridge_id, name, position_index AS position,
               created_at, updated_at, is_deleted
        FROM Shelves
        WHERE id = @id AND is_deleted = 0
      `);

    return res.recordset[0] ?? null;
  }

  async listByFridge(fridgeId: string): Promise<ShelfRow[]> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("fridge_id", sql.UniqueIdentifier, fridgeId)
      .query(`
        SELECT id, fridge_id, name, position_index AS position,
               created_at, updated_at, is_deleted
        FROM Shelves
        WHERE fridge_id = @fridge_id AND is_deleted = 0
        ORDER BY position_index ASC, created_at ASC
      `);

    return res.recordset as ShelfRow[];
  }

  async update(id: string, patch: { name?: string; position?: number | null }): Promise<ShelfRow> {
    const pool = await poolPromise;

    const fields: string[] = [];
    const req = pool.request().input("id", sql.UniqueIdentifier, id);

    if ("name" in patch && patch.name !== undefined) {
      fields.push("name = @name");
      req.input("name", sql.NVarChar(255), patch.name);
    }
    if ("position" in patch) {
      fields.push("position_index = @position_index");
      req.input("position_index", sql.Int, patch.position ?? null);
    }

    if (fields.length === 0) {
      const current = await this.findById(id);
      if (!current) throw new Error("Shelf not found");
      return current;
    }

    await req.query(`
      UPDATE Shelves
      SET ${fields.join(", ")}
      WHERE id = @id AND is_deleted = 0
    `);

    const updated = await this.findById(id);
    if (!updated) throw new Error("Shelf not found");
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.UniqueIdentifier, id)
      .query("UPDATE Shelves SET is_deleted = 1, updated_at = SYSDATETIME() WHERE id = @id");
  }

  async hasProducts(shelfId: string): Promise<boolean> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("shelf_id", sql.UniqueIdentifier, shelfId)
      .query(`
        SELECT
          CASE
            WHEN EXISTS (SELECT 1 FROM Products WHERE shelf_id = @shelf_id)
            THEN 1
            ELSE 0
          END AS has_products
      `);

    return res.recordset[0].has_products === 1;
  }

  async getFridgeIdByShelfId(shelfId: string): Promise<string | null> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("id", sql.UniqueIdentifier, shelfId)
      .query("SELECT TOP 1 fridge_id FROM Shelves WHERE id = @id AND is_deleted = 0");

    return res.recordset[0]?.fridge_id ?? null;
  }
}
