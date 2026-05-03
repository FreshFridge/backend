import { poolPromise, sql } from "../db/mssql";
import { logger } from "../utils/logger";

type ProductForCheck = {
  id: string;
  user_id: string;
  name: string;
  expiration_date: string | null;
};

type NotificationCheck = {
  id: string;
  created_at: Date;
};

export class FreshnessJob {
  private isRunning = false;

  async run(): Promise<{ checked: number; created: number }> {
    if (this.isRunning) {
      logger.info("Freshness job already running, skipping");
      return { checked: 0, created: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info("Starting freshness check");

      const expiringThresholdDays = parseInt(process.env.EXPIRING_SOON_DAYS ?? "2", 10);
      const cooldownHours = parseInt(process.env.NOTIFICATION_COOLDOWN_HOURS ?? "24", 10);

      const products = await this.getActiveProducts();
      let notificationsCreated = 0;

      for (const product of products) {
        if (!product.expiration_date) continue;

        const expiryDate = new Date(product.expiration_date);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let notificationType: string | null = null;
        let title: string = "";
        let message: string = "";
        let severity: string = "";

        if (daysUntilExpiry < 0) {
          // Expired
          notificationType = "EXPIRED";
          title = "Product expired";
          message = `Your product "${product.name}" expired ${Math.abs(daysUntilExpiry)} day(s) ago`;
          severity = "CRITICAL";
        } else if (daysUntilExpiry >= 0 && daysUntilExpiry <= expiringThresholdDays) {
          // Expiring soon
          notificationType = "EXPIRING_SOON";
          title = "Product expiring soon";
          message = `Your product "${product.name}" will expire in ${daysUntilExpiry} day(s)`;
          severity = "WARN";
        }

        if (notificationType) {
          const shouldCreate = await this.shouldCreateNotification(
            product.user_id,
            product.id,
            notificationType,
            cooldownHours
          );

          if (shouldCreate) {
            await this.createNotification({
              userId: product.user_id,
              type: notificationType,
              title,
              message,
              relatedEntityType: "PRODUCT",
              relatedEntityId: product.id,
              severity,
            });
            notificationsCreated++;
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info("Freshness check completed", {
        durationMs: duration,
        checked: products.length,
        created: notificationsCreated,
      });

      return { checked: products.length, created: notificationsCreated };
    } catch (error) {
      logger.error("Freshness job failed", { error: error instanceof Error ? error.message : String(error) });
      return { checked: 0, created: 0 };
    } finally {
      this.isRunning = false;
    }
  }

  private async getActiveProducts(): Promise<ProductForCheck[]> {
    const pool = await poolPromise;

    const res = await pool.request().query(`
      SELECT id, user_id, name, expiration_date
      FROM Products
      WHERE status = 'active' AND expiration_date IS NOT NULL
    `);

    return res.recordset as ProductForCheck[];
  }

  private async shouldCreateNotification(
    userId: string,
    productId: string,
    notificationType: string,
    cooldownHours: number
  ): Promise<boolean> {
    const pool = await poolPromise;

    const res = await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("product_id", sql.UniqueIdentifier, productId)
      .input("type", sql.NVarChar(50), notificationType)
      .input("cooldown_hours", sql.Int, cooldownHours)
      .query(`
        SELECT TOP 1 id, created_at
        FROM UserNotifications
        WHERE user_id = @user_id
          AND related_entity_id = @product_id
          AND type = @type
          AND is_deleted = 0
          AND created_at > DATEADD(hour, -@cooldown_hours, SYSDATETIME())
        ORDER BY created_at DESC
      `);

    return res.recordset.length === 0;
  }

  private async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedEntityType: string;
    relatedEntityId: string;
    severity: string;
  }): Promise<void> {
    const pool = await poolPromise;

    await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, data.userId)
      .input("type", sql.NVarChar(50), data.type)
      .input("title", sql.NVarChar(200), data.title)
      .input("message", sql.NVarChar(1000), data.message)
      .input("related_entity_type", sql.NVarChar(50), data.relatedEntityType)
      .input("related_entity_id", sql.UniqueIdentifier, data.relatedEntityId)
      .input("severity", sql.NVarChar(20), data.severity)
      .query(`
        INSERT INTO UserNotifications (
          id, user_id, type, title, message,
          related_entity_type, related_entity_id, severity,
          is_read, read_at, created_at, updated_at, is_deleted
        )
        VALUES (
          NEWID(), @user_id, @type, @title, @message,
          @related_entity_type, @related_entity_id, @severity,
          0, NULL, SYSDATETIME(), SYSDATETIME(), 0
        )
      `);
  }
}
