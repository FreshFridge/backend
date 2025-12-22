import { NotFoundError } from "../../utils/errors";
import { AdminRepository } from "./admin.repo";

export class AdminService {
  private repo = new AdminRepository();

  async listUsers(filters: { limit: number; offset: number; role?: string; is_blocked?: boolean }) {
    return this.repo.listUsers(filters);
  }

  async getUserById(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  async updateUserRole(adminUserId: string, targetUserId: string, role: string) {
    const user = await this.repo.findUserById(targetUserId);
    if (!user) throw new NotFoundError("User not found");

    await this.repo.updateUserRole(targetUserId, role);

    await this.repo.createAuditLog({
      admin_user_id: adminUserId,
      action: "UPDATE_USER_ROLE",
      target_user_id: targetUserId,
      details: `Changed role from ${user.role} to ${role}`,
    });

    return this.repo.findUserById(targetUserId);
  }

  async updateUserBlockStatus(adminUserId: string, targetUserId: string, is_blocked: boolean) {
    const user = await this.repo.findUserById(targetUserId);
    if (!user) throw new NotFoundError("User not found");

    await this.repo.updateUserBlockStatus(targetUserId, is_blocked);

    await this.repo.createAuditLog({
      admin_user_id: adminUserId,
      action: is_blocked ? "BLOCK_USER" : "UNBLOCK_USER",
      target_user_id: targetUserId,
      details: is_blocked ? "User blocked" : "User unblocked",
    });

    return this.repo.findUserById(targetUserId);
  }

  async getSettings() {
    const [systemSettings, telemetryThreshold] = await Promise.all([
      this.repo.getActiveSystemSettings(),
      this.repo.getActiveTelemetryThreshold(),
    ]);

    if (!systemSettings) throw new NotFoundError("System settings not found");
    if (!telemetryThreshold) throw new NotFoundError("Telemetry threshold not found");

    return {
      system: {
        expiring_soon_days: systemSettings.expiring_soon_days,
        notification_cooldown_hours: systemSettings.notification_cooldown_hours,
      },
      telemetry: {
        min_temperature: telemetryThreshold.min_temperature,
        max_temperature: telemetryThreshold.max_temperature,
        min_humidity: telemetryThreshold.min_humidity,
        max_humidity: telemetryThreshold.max_humidity,
        max_door_open_seconds: telemetryThreshold.max_door_open_seconds,
      },
    };
  }

  async updateSettings(
    adminUserId: string,
    settings: {
      expiring_soon_days?: number;
      notification_cooldown_hours?: number;
      min_temperature?: number;
      max_temperature?: number;
      min_humidity?: number | null;
      max_humidity?: number | null;
      max_door_open_seconds?: number;
    }
  ) {
    const systemUpdates: any = {};
    const telemetryUpdates: any = {};

    if (settings.expiring_soon_days !== undefined) {
      systemUpdates.expiring_soon_days = settings.expiring_soon_days;
    }
    if (settings.notification_cooldown_hours !== undefined) {
      systemUpdates.notification_cooldown_hours = settings.notification_cooldown_hours;
    }

    if (settings.min_temperature !== undefined) {
      telemetryUpdates.min_temperature = settings.min_temperature;
    }
    if (settings.max_temperature !== undefined) {
      telemetryUpdates.max_temperature = settings.max_temperature;
    }
    if (settings.min_humidity !== undefined) {
      telemetryUpdates.min_humidity = settings.min_humidity;
    }
    if (settings.max_humidity !== undefined) {
      telemetryUpdates.max_humidity = settings.max_humidity;
    }
    if (settings.max_door_open_seconds !== undefined) {
      telemetryUpdates.max_door_open_seconds = settings.max_door_open_seconds;
    }

    await Promise.all([
      Object.keys(systemUpdates).length > 0 ? this.repo.updateSystemSettings(systemUpdates) : Promise.resolve(),
      Object.keys(telemetryUpdates).length > 0 ? this.repo.updateTelemetryThreshold(telemetryUpdates) : Promise.resolve(),
    ]);

    await this.repo.createAuditLog({
      admin_user_id: adminUserId,
      action: "UPDATE_SETTINGS",
      target_user_id: null,
      details: JSON.stringify(settings),
    });

    return this.getSettings();
  }

  async listAuditLogs(filters: {
    limit: number;
    offset: number;
    admin_user_id?: string;
    target_user_id?: string;
    action?: string;
  }) {
    return this.repo.listAuditLogs(filters);
  }
}
