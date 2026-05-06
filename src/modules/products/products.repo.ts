import { poolPromise, sql } from "../../db/mssql";

export type ProductRow = {
  id: string;
  user_id: string;
  fridge_id: string | null;
  shelf_id: string | null;
  category_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  purchase_date: string | null;
  expiration_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export class ProductsRepository {
  async create(userId: string, dto: any): Promise<ProductRow> {
    const pool = await poolPromise;

    const req = pool.request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("fridge_id", sql.UniqueIdentifier, dto.fridge_id ?? null)
      .input("shelf_id", sql.UniqueIdentifier, dto.shelf_id ?? null)
      .input("category_id", sql.UniqueIdentifier, dto.category_id)
      .input("name", sql.NVarChar(255), dto.name)
      .input("quantity", sql.Decimal(8, 2), dto.quantity ?? null)
      .input("unit", sql.NVarChar(50), dto.unit ?? null)
      .input("purchase_date", sql.Date, dto.purchase_date ?? null)
      .input("expiration_date", sql.Date, dto.expiration_date ?? null)
      .input("status", sql.NVarChar(50), dto.status)
      .input("notes", sql.NVarChar(500), dto.notes ?? null);

    const res = await req.query(`
      INSERT INTO Products (
        id, user_id, fridge_id, shelf_id, category_id,
        name, quantity, unit, purchase_date, expiration_date,
        status, notes, created_at
      )
      OUTPUT INSERTED.*
      VALUES (
        NEWID(), @user_id, @fridge_id, @shelf_id, @category_id,
        @name, @quantity, @unit, @purchase_date, @expiration_date,
        @status, @notes, SYSDATETIME()
      )
    `);

    return res.recordset[0];
  }

  async findById(id: string): Promise<ProductRow | null> {
    const pool = await poolPromise;
    const res = await pool.request()
      .input("id", sql.UniqueIdentifier, id)
      .query("SELECT TOP 1 * FROM Products WHERE id = @id");
    return res.recordset[0] ?? null;
  }

  async list(userId: string, query: any) {
    const pool = await poolPromise;

    // Динамічний WHERE (параметризовано)
    const conditions: string[] = ["user_id = @user_id", "status <> 'removed'"];
    const req = pool.request().input("user_id", sql.UniqueIdentifier, userId);

    if (query.status) {
      conditions.push("status = @status");
      req.input("status", sql.NVarChar(50), query.status);
    }
    if (query.fridgeId) {
      conditions.push("fridge_id = @fridge_id");
      req.input("fridge_id", sql.UniqueIdentifier, query.fridgeId);
    }
    if (query.shelfId) {
      conditions.push("shelf_id = @shelf_id");
      req.input("shelf_id", sql.UniqueIdentifier, query.shelfId);
    }
    if (query.categoryId) {
      conditions.push("category_id = @category_id");
      req.input("category_id", sql.UniqueIdentifier, query.categoryId);
    }
    if (query.q) {
      conditions.push("(name LIKE @q OR notes LIKE @q)");
      req.input("q", sql.NVarChar(510), `%${query.q}%`);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const sortFields: Record<string, string> = {
      createdAt: "created_at",
      created_at: "created_at",
      expirationDate: "expiration_date",
      expiration_date: "expiration_date",
      name: "name",
    };
    const sortField = sortFields[query.sort] ?? "created_at";
    const sortOrder = query.order === "asc" ? "ASC" : "DESC";

    const offset = (query.page - 1) * query.limit;

    req.input("limit", sql.Int, query.limit);
    req.input("offset", sql.Int, offset);

    const data = await req.query(`
      SELECT *
      FROM Products
      ${whereSql}
      ORDER BY ${sortField} ${sortOrder}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

      SELECT COUNT(1) AS total
      FROM Products
      ${whereSql};
    `);

    // mssql повертає кілька recordset
    const recordsets = data.recordsets as any[];

    const items = recordsets[0] as ProductRow[];
    const total = recordsets[1][0].total as number;

    return { items, total, page: query.page, limit: query.limit };
  }

  async update(id: string, patch: any): Promise<ProductRow> {
    const pool = await poolPromise;

    const fields: string[] = [];
    const req = pool.request().input("id", sql.UniqueIdentifier, id);

    const add = (col: string, param: string, type: any, value: any) => {
      fields.push(`${col} = @${param}`);
      req.input(param, type, value);
    };

    if ("fridge_id" in patch) add("fridge_id", "fridge_id", sql.UniqueIdentifier, patch.fridge_id ?? null);
    if ("shelf_id" in patch) add("shelf_id", "shelf_id", sql.UniqueIdentifier, patch.shelf_id ?? null);
    if ("category_id" in patch) add("category_id", "category_id", sql.UniqueIdentifier, patch.category_id);
    if ("name" in patch) add("name", "name", sql.NVarChar(255), patch.name);
    if ("quantity" in patch) add("quantity", "quantity", sql.Decimal(8, 2), patch.quantity ?? null);
    if ("unit" in patch) add("unit", "unit", sql.NVarChar(50), patch.unit ?? null);
    if ("purchase_date" in patch) add("purchase_date", "purchase_date", sql.Date, patch.purchase_date ?? null);
    if ("expiration_date" in patch) add("expiration_date", "expiration_date", sql.Date, patch.expiration_date ?? null);
    if ("status" in patch) add("status", "status", sql.NVarChar(50), patch.status);
    if ("notes" in patch) add("notes", "notes", sql.NVarChar(500), patch.notes ?? null);

    if (fields.length === 0) {
      // нічого оновлювати
      const current = await this.findById(id);
      if (!current) throw new Error("Product not found");
      return current;
    }

    const res = await req.query(`
      UPDATE Products
      SET ${fields.join(", ")}
      OUTPUT INSERTED.*
      WHERE id = @id
    `);

    return res.recordset[0];
  }

  async remove(id: string): Promise<void> {
    const pool = await poolPromise;
    await pool.request()
      .input("id", sql.UniqueIdentifier, id)
      .query("DELETE FROM Products WHERE id = @id");
  }

  async expiring(userId: string, days: number) {
    const pool = await poolPromise;
    const res = await pool.request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("days", sql.Int, days)
      .query(`
        SELECT *
        FROM Products
        WHERE user_id = @user_id
          AND status = 'active'
          AND expiration_date IS NOT NULL
          AND expiration_date <= DATEADD(day, @days, CAST(GETDATE() AS date))
        ORDER BY expiration_date ASC
      `);

    return res.recordset as ProductRow[];
  }
}

