-- Migration: Add Fridges and Shelves tables
-- This migration creates tables for organizing products into fridges and shelves

-- ==================================================
-- 1. FRIDGES TABLE
-- ==================================================
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

-- Index for fast user-based queries
CREATE INDEX IX_Fridges_UserId ON Fridges(user_id) WHERE is_deleted = 0;

-- Index for created_at sorting
CREATE INDEX IX_Fridges_CreatedAt ON Fridges(created_at DESC);

-- ==================================================
-- 2. SHELVES TABLE
-- ==================================================
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

-- Index for fast fridge-based queries
CREATE INDEX IX_Shelves_FridgeId ON Shelves(fridge_id) WHERE is_deleted = 0;

-- Index for position ordering within fridge
CREATE INDEX IX_Shelves_Position ON Shelves(fridge_id, position) WHERE is_deleted = 0;

-- ==================================================
-- 3. ADD FOREIGN KEY TO PRODUCTS (if not exists)
-- ==================================================
-- Note: Products table already has fridge_id and shelf_id columns
-- This adds foreign key constraints to ensure referential integrity

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_Products_Fridges'
)
BEGIN
    ALTER TABLE Products
    ADD CONSTRAINT FK_Products_Fridges
    FOREIGN KEY (fridge_id) REFERENCES Fridges(id);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_Products_Shelves'
)
BEGIN
    ALTER TABLE Products
    ADD CONSTRAINT FK_Products_Shelves
    FOREIGN KEY (shelf_id) REFERENCES Shelves(id);
END

-- ==================================================
-- 4. TRIGGER FOR UPDATED_AT (optional but recommended)
-- ==================================================

-- Trigger to auto-update updated_at for Fridges
GO
CREATE TRIGGER TR_Fridges_UpdatedAt
ON Fridges
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Fridges
    SET updated_at = SYSDATETIME()
    FROM Fridges f
    INNER JOIN inserted i ON f.id = i.id;
END
GO

-- Trigger to auto-update updated_at for Shelves
CREATE TRIGGER TR_Shelves_UpdatedAt
ON Shelves
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Shelves
    SET updated_at = SYSDATETIME()
    FROM Shelves s
    INNER JOIN inserted i ON s.id = i.id;
END
GO
