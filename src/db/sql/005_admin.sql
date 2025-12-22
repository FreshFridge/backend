-- Migration: Add Admin functionality (RBAC, User Management, System Settings, Audit Log)
-- This migration extends Users table and creates SystemSettings and AdminAuditLog tables

-- ==================================================
-- 1. EXTEND USERS TABLE
-- ==================================================

-- Add role column (if not exists)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'role')
BEGIN
    ALTER TABLE Users ADD role NVARCHAR(20) NOT NULL DEFAULT 'user';
END

-- Add is_blocked column (if not exists)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'is_blocked')
BEGIN
    ALTER TABLE Users ADD is_blocked BIT NOT NULL DEFAULT 0;
END

-- Add blocked_at column (if not exists)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'blocked_at')
BEGIN
    ALTER TABLE Users ADD blocked_at DATETIME2 NULL;
END

-- Add updated_at column (if not exists)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'updated_at')
BEGIN
    ALTER TABLE Users ADD updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME();
END

-- Create indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Role')
BEGIN
    CREATE INDEX IX_Users_Role ON Users(role);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_IsBlocked')
BEGIN
    CREATE INDEX IX_Users_IsBlocked ON Users(is_blocked);
END

-- Create trigger for auto-update updated_at
GO
IF OBJECT_ID('TR_Users_UpdatedAt', 'TR') IS NOT NULL
    DROP TRIGGER TR_Users_UpdatedAt;
GO
CREATE TRIGGER TR_Users_UpdatedAt
ON Users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Users
    SET updated_at = SYSDATETIME()
    FROM Users u
    INNER JOIN inserted i ON u.id = i.id;
END
GO

-- ==================================================
-- 2. SYSTEM SETTINGS TABLE
-- ==================================================
CREATE TABLE SystemSettings (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    expiring_soon_days INT NOT NULL DEFAULT 2,
    notification_cooldown_hours INT NOT NULL DEFAULT 24,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    is_active BIT NOT NULL DEFAULT 1
);

-- Index for active settings
CREATE INDEX IX_SystemSettings_IsActive
ON SystemSettings(is_active)
WHERE is_active = 1;

-- Insert default active row
INSERT INTO SystemSettings (
    id,
    expiring_soon_days,
    notification_cooldown_hours,
    created_at,
    updated_at,
    is_active
)
VALUES (
    NEWID(),
    2,
    24,
    SYSDATETIME(),
    SYSDATETIME(),
    1
);

-- Trigger for auto-update updated_at
GO
CREATE TRIGGER TR_SystemSettings_UpdatedAt
ON SystemSettings
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE SystemSettings
    SET updated_at = SYSDATETIME()
    FROM SystemSettings s
    INNER JOIN inserted i ON s.id = i.id;
END
GO

-- ==================================================
-- 3. ADMIN AUDIT LOG TABLE
-- ==================================================
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

-- Index for retrieving admin's actions
CREATE INDEX IX_AdminAuditLog_AdminUserId_CreatedAt
ON AdminAuditLog(admin_user_id, created_at DESC);

-- Index for retrieving actions on a target user
CREATE INDEX IX_AdminAuditLog_TargetUserId_CreatedAt
ON AdminAuditLog(target_user_id, created_at DESC);

-- Index for action type
CREATE INDEX IX_AdminAuditLog_Action
ON AdminAuditLog(action);
