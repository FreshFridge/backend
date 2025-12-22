-- Migration: Add Telemetry (IoT) tables
-- This migration creates tables for IoT telemetry data and threshold configuration

-- ==================================================
-- 1. FRIDGE TELEMETRY TABLE
-- ==================================================
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

-- Index for retrieving telemetry by fridge, sorted by time
CREATE INDEX IX_FridgeTelemetry_FridgeId_RecordedAt
ON FridgeTelemetry(fridge_id, recorded_at DESC);

-- Index for fridge lookup
CREATE INDEX IX_FridgeTelemetry_FridgeId
ON FridgeTelemetry(fridge_id);

-- ==================================================
-- 2. TELEMETRY THRESHOLDS TABLE
-- ==================================================
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

-- Index for retrieving active threshold
CREATE INDEX IX_TelemetryThresholds_IsActive
ON TelemetryThresholds(is_active)
WHERE is_active = 1;

-- Insert default active threshold
INSERT INTO TelemetryThresholds (
    id,
    min_temperature,
    max_temperature,
    min_humidity,
    max_humidity,
    max_door_open_seconds,
    created_at,
    is_active
)
VALUES (
    NEWID(),
    0.00,
    8.00,
    NULL,
    NULL,
    60,
    SYSDATETIME(),
    1
);
