import { ForbiddenError, NotFoundError } from "../../../utils/errors";
import { logger } from "../../../utils/logger";
import { FridgesRepository } from "../../fridges/fridges.repo";
import { NotificationsRepository } from "../../notifications/notifications.repo";
import { TelemetryRepository } from "./telemetry.repo";

export class TelemetryService {
  private repo = new TelemetryRepository();
  private fridgesRepo = new FridgesRepository();
  private notificationsRepo = new NotificationsRepository();

  async ingestTelemetry(
    userId: string,
    data: {
      fridge_id: string;
      temperature: number;
      humidity?: number | null;
      door_open: boolean;
    }
  ) {
    // Verify fridge exists and belongs to user
    const fridge = await this.fridgesRepo.findById(data.fridge_id);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");

    // Save telemetry record
    const telemetry = await this.repo.createTelemetryRecord(data);

    // Analyze against thresholds and generate notifications
    await this.analyzeAndNotify(userId, fridge.id, data);

    return telemetry;
  }

  async listTelemetry(userId: string, fridgeId: string, query: { limit: number; offset: number }) {
    // Verify ownership
    const fridge = await this.fridgesRepo.findById(fridgeId);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");

    return this.repo.listTelemetry(fridgeId, query);
  }

  async getLatestTelemetry(userId: string, fridgeId: string) {
    // Verify ownership
    const fridge = await this.fridgesRepo.findById(fridgeId);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");

    const telemetry = await this.repo.getLatestTelemetry(fridgeId);
    if (!telemetry) throw new NotFoundError("No telemetry data available for this fridge");

    return telemetry;
  }

  private async analyzeAndNotify(
    userId: string,
    fridgeId: string,
    data: {
      temperature: number;
      humidity?: number | null;
      door_open: boolean;
    }
  ): Promise<void> {
    const threshold = await this.repo.getActiveThreshold();
    if (!threshold) {
      logger.warn("No active telemetry threshold configured");
      return;
    }

    const violations: Array<{ type: string; title: string; message: string; severity: string }> = [];

    // Check temperature
    if (data.temperature < threshold.min_temperature) {
      violations.push({
        type: "STORAGE_CONDITION_ALERT",
        title: "Temperature too low",
        message: `Fridge temperature (${data.temperature}°C) is below minimum (${threshold.min_temperature}°C)`,
        severity: "CRITICAL",
      });
    } else if (data.temperature > threshold.max_temperature) {
      violations.push({
        type: "STORAGE_CONDITION_ALERT",
        title: "Temperature too high",
        message: `Fridge temperature (${data.temperature}°C) exceeds maximum (${threshold.max_temperature}°C)`,
        severity: "CRITICAL",
      });
    }

    // Check humidity (if limits configured and value provided)
    if (data.humidity !== null && data.humidity !== undefined) {
      if (threshold.min_humidity !== null && data.humidity < threshold.min_humidity) {
        violations.push({
          type: "STORAGE_CONDITION_ALERT",
          title: "Humidity too low",
          message: `Fridge humidity (${data.humidity}%) is below minimum (${threshold.min_humidity}%)`,
          severity: "WARN",
        });
      } else if (threshold.max_humidity !== null && data.humidity > threshold.max_humidity) {
        violations.push({
          type: "STORAGE_CONDITION_ALERT",
          title: "Humidity too high",
          message: `Fridge humidity (${data.humidity}%) exceeds maximum (${threshold.max_humidity}%)`,
          severity: "WARN",
        });
      }
    }

    // Check door open
    if (data.door_open) {
      violations.push({
        type: "STORAGE_CONDITION_ALERT",
        title: "Door open detected",
        message: `Fridge door is currently open (threshold: ${threshold.max_door_open_seconds} seconds)`,
        severity: "WARN",
      });
    }

    // Create notifications for violations (with anti-duplicate check)
    for (const violation of violations) {
      const recentAlertExists = await this.repo.checkRecentAlert(fridgeId, violation.type, 30);

      if (!recentAlertExists) {
        await this.notificationsRepo.create(userId, {
          type: violation.type,
          title: violation.title,
          message: violation.message,
          related_entity_type: "FRIDGE",
          related_entity_id: fridgeId,
          severity: violation.severity,
        });
      }
    }
  }
}
