-- Migration: Add IoT device API keys
-- Stores only SHA-256 hashes of device API keys and links each device to a fridge.

IF OBJECT_ID('IoTDevices', 'U') IS NULL
BEGIN
  CREATE TABLE IoTDevices (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL,
    fridge_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(255) NOT NULL,
    api_key_hash NVARCHAR(128) NOT NULL UNIQUE,
    api_key_prefix NVARCHAR(32) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    last_used_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_IoTDevices_Users FOREIGN KEY (user_id) REFERENCES Users(id),
    CONSTRAINT FK_IoTDevices_Fridges FOREIGN KEY (fridge_id) REFERENCES Fridges(id)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_IoTDevices_UserId')
  CREATE INDEX IX_IoTDevices_UserId ON IoTDevices(user_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_IoTDevices_FridgeId')
  CREATE INDEX IX_IoTDevices_FridgeId ON IoTDevices(fridge_id);