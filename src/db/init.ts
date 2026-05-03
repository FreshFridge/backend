import sql from "mssql";
import { logger } from "./../utils/logger";

const database = process.env.DB_DATABASE ?? "FreshFridgeDB";
const retries = Number(process.env.DB_CONNECT_RETRIES ?? 30);
const retryDelayMs = Number(process.env.DB_CONNECT_RETRY_DELAY_MS ?? 5000);

const serverConfig: sql.config = {
  server: process.env.DB_SERVER ?? "localhost",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  database: "master",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

const appConfig: sql.config = {
  ...serverConfig,
  database,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect(config: sql.config): Promise<sql.ConnectionPool> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await new sql.ConnectionPool(config).connect();
    } catch (err) {
      lastError = err;
      logger.error("DB init connection failed", { attempt, retries });
      if (attempt < retries) {
        await delay(retryDelayMs);
      }
    }
  }

  throw lastError;
}

async function run(): Promise<void> {
  const masterPool = await connect(serverConfig);
  await masterPool
    .request()
    .input("database", sql.NVarChar(128), database)
    .query(`
      IF DB_ID(@database) IS NULL
      BEGIN
        DECLARE @sql NVARCHAR(MAX) = N'CREATE DATABASE ' + QUOTENAME(@database);
        EXEC(@sql);
      END
    `);
  await masterPool.close();

  const pool = await connect(appConfig);

  await pool.request().query(`
    IF OBJECT_ID('Users', 'U') IS NULL
    BEGIN
      CREATE TABLE Users (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        full_name NVARCHAR(255) NOT NULL,
        locale NVARCHAR(50) NOT NULL,
        timezone NVARCHAR(50) NOT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        role NVARCHAR(20) NOT NULL DEFAULT 'user',
        is_blocked BIT NOT NULL DEFAULT 0,
        blocked_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    END

    IF OBJECT_ID('Products', 'U') IS NULL
    BEGIN
      CREATE TABLE Products (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        fridge_id UNIQUEIDENTIFIER NULL,
        shelf_id UNIQUEIDENTIFIER NULL,
        category_id UNIQUEIDENTIFIER NOT NULL,
        name NVARCHAR(255) NOT NULL,
        quantity DECIMAL(8,2) NULL,
        unit NVARCHAR(50) NULL,
        purchase_date DATE NULL,
        expiration_date DATE NULL,
        status NVARCHAR(50) NOT NULL,
        notes NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_Products_Users FOREIGN KEY (user_id) REFERENCES Users(id)
      );
    END

    IF OBJECT_ID('Fridges', 'U') IS NULL
    BEGIN
      CREATE TABLE Fridges (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        is_deleted BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_Fridges_Users FOREIGN KEY (user_id) REFERENCES Users(id)
      );
    END

    IF OBJECT_ID('Shelves', 'U') IS NULL
    BEGIN
      CREATE TABLE Shelves (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        fridge_id UNIQUEIDENTIFIER NOT NULL,
        name NVARCHAR(255) NOT NULL,
        position INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        is_deleted BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_Shelves_Fridges FOREIGN KEY (fridge_id) REFERENCES Fridges(id)
      );
    END

    IF OBJECT_ID('UserNotifications', 'U') IS NULL
    BEGIN
      CREATE TABLE UserNotifications (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        type NVARCHAR(50) NOT NULL,
        title NVARCHAR(200) NOT NULL,
        message NVARCHAR(1000) NOT NULL,
        related_entity_type NVARCHAR(50) NULL,
        related_entity_id UNIQUEIDENTIFIER NULL,
        severity NVARCHAR(20) NOT NULL DEFAULT 'INFO',
        is_read BIT NOT NULL DEFAULT 0,
        read_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        is_deleted BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_UserNotifications_Users FOREIGN KEY (user_id) REFERENCES Users(id)
      );
    END

    IF OBJECT_ID('TelemetryThresholds', 'U') IS NULL
    BEGIN
      CREATE TABLE TelemetryThresholds (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        min_temperature DECIMAL(5,2) NOT NULL,
        max_temperature DECIMAL(5,2) NOT NULL,
        min_humidity DECIMAL(5,2) NULL,
        max_humidity DECIMAL(5,2) NULL,
        max_door_open_seconds INT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        is_active BIT NOT NULL DEFAULT 1
      );
    END

    IF OBJECT_ID('FridgeTelemetry', 'U') IS NULL
    BEGIN
      CREATE TABLE FridgeTelemetry (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        fridge_id UNIQUEIDENTIFIER NOT NULL,
        temperature DECIMAL(5,2) NOT NULL,
        humidity DECIMAL(5,2) NULL,
        door_open BIT NOT NULL,
        recorded_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_FridgeTelemetry_Fridges FOREIGN KEY (fridge_id) REFERENCES Fridges(id)
      );
    END

    IF OBJECT_ID('SystemSettings', 'U') IS NULL
    BEGIN
      CREATE TABLE SystemSettings (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        expiring_soon_days INT NOT NULL DEFAULT 2,
        notification_cooldown_hours INT NOT NULL DEFAULT 24,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        is_active BIT NOT NULL DEFAULT 1
      );
    END

    IF OBJECT_ID('AdminAuditLog', 'U') IS NULL
    BEGIN
      CREATE TABLE AdminAuditLog (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        admin_user_id UNIQUEIDENTIFIER NOT NULL,
        action NVARCHAR(50) NOT NULL,
        target_user_id UNIQUEIDENTIFIER NULL,
        details NVARCHAR(1000) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_AdminAuditLog_AdminUser FOREIGN KEY (admin_user_id) REFERENCES Users(id),
        CONSTRAINT FK_AdminAuditLog_TargetUser FOREIGN KEY (target_user_id) REFERENCES Users(id)
      );
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Fridges_UserId')
      CREATE INDEX IX_Fridges_UserId ON Fridges(user_id) WHERE is_deleted = 0;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Shelves_FridgeId')
      CREATE INDEX IX_Shelves_FridgeId ON Shelves(fridge_id) WHERE is_deleted = 0;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_UserId')
      CREATE INDEX IX_Products_UserId ON Products(user_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_ExpirationDate')
      CREATE INDEX IX_Products_ExpirationDate ON Products(expiration_date);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserNotifications_UserId_CreatedAt')
      CREATE INDEX IX_UserNotifications_UserId_CreatedAt ON UserNotifications(user_id, created_at DESC) WHERE is_deleted = 0;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FridgeTelemetry_FridgeId_RecordedAt')
      CREATE INDEX IX_FridgeTelemetry_FridgeId_RecordedAt ON FridgeTelemetry(fridge_id, recorded_at DESC);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TelemetryThresholds_IsActive')
      CREATE INDEX IX_TelemetryThresholds_IsActive ON TelemetryThresholds(is_active) WHERE is_active = 1;

    IF NOT EXISTS (SELECT 1 FROM TelemetryThresholds WHERE is_active = 1)
    BEGIN
      INSERT INTO TelemetryThresholds (
        min_temperature, max_temperature, min_humidity, max_humidity, max_door_open_seconds, is_active
      )
      VALUES (0.00, 8.00, NULL, NULL, 60, 1);
    END

    IF NOT EXISTS (SELECT 1 FROM SystemSettings WHERE is_active = 1)
    BEGIN
      INSERT INTO SystemSettings (expiring_soon_days, notification_cooldown_hours, is_active)
      VALUES (2, 24, 1);
    END
  `);

  const seedUserId = process.env.IOT_USER_ID ?? "11111111-1111-4111-8111-111111111111";
  const seedFridgeId = process.env.IOT_FRIDGE_ID ?? "22222222-2222-4222-8222-222222222222";

  await pool
    .request()
    .input("user_id", sql.UniqueIdentifier, seedUserId)
    .input("fridge_id", sql.UniqueIdentifier, seedFridgeId)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM Users WHERE id = @user_id)
      BEGIN
        INSERT INTO Users (
          id, email, password_hash, full_name, locale, timezone,
          is_active, role, is_blocked, created_at, updated_at
        )
        VALUES (
          @user_id, 'iot-device-valid@freshfridge.local', 'not_used_for_iot_seed',
          'FreshFridge IoT Device', 'uk-UA', 'Europe/Kyiv',
          1, 'user', 0, SYSDATETIME(), SYSDATETIME()
        );
      END

      IF NOT EXISTS (SELECT 1 FROM Fridges WHERE id = @fridge_id)
      BEGIN
        INSERT INTO Fridges (id, user_id, name, description, created_at, updated_at, is_deleted)
        VALUES (
          @fridge_id, @user_id, 'Docker Demo Fridge',
          'Seed fridge for IoT simulator telemetry',
          SYSDATETIME(), SYSDATETIME(), 0
        );
      END
    `);

  await pool.close();
  logger.info("Database initialized");
}

run().catch((err) => {
  logger.error("Database initialization failed", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
