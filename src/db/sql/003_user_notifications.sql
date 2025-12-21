-- Migration: Add UserNotifications table
-- This migration creates table for user notifications (separate from legacy dbo.Notifications)

-- ==================================================
-- 1. USER NOTIFICATIONS TABLE
-- ==================================================
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

-- Index for listing user notifications sorted by creation date
CREATE INDEX IX_UserNotifications_UserId_CreatedAt
ON UserNotifications(user_id, created_at DESC)
WHERE is_deleted = 0;

-- Index for filtering by read status
CREATE INDEX IX_UserNotifications_UserId_IsRead
ON UserNotifications(user_id, is_read)
WHERE is_deleted = 0;

-- ==================================================
-- 2. TRIGGER FOR UPDATED_AT
-- ==================================================
GO
CREATE TRIGGER TR_UserNotifications_UpdatedAt
ON UserNotifications
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE UserNotifications
    SET updated_at = SYSDATETIME()
    FROM UserNotifications n
    INNER JOIN inserted i ON n.id = i.id;
END
GO
