import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../../utils/errors";
import { logger } from "../../../utils/logger";
import { FridgesRepository } from "../../fridges/fridges.repo";
import { IotDevicesRepository } from "../devices/iotDevices.repo";
import { IotDevicesService } from "../devices/iotDevices.service";
import { NotificationsRepository } from "../../notifications/notifications.repo";
import { TelemetryRepository } from "./telemetry.repo";

type TelemetryPayload = {
  fridge_id: string;
  temperature: number;
  humidity?: number | null;
  door_open: boolean;
};

export class TelemetryService {
  private repo = new TelemetryRepository();
  private fridgesRepo = new FridgesRepository();
  private devicesRepo = new IotDevicesRepository();
  private notificationsRepo = new NotificationsRepository();

  async ingestTelemetry(userId: string, data: TelemetryPayload) {
    const fridge = await this.fridgesRepo.findById(data.fridge_id);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");

    const telemetry = await this.repo.createTelemetryRecord(data);
    await this.analyzeAndNotify(userId, fridge.id, data);

    return telemetry;
  }

  async ingestTelemetryWithApiKey(apiKey: string | undefined, data: TelemetryPayload) {
    if (!apiKey) throw new UnauthorizedError("Missing API key");

    const device = await this.devicesRepo.findByApiKeyHash(IotDevicesService.hashApiKey(apiKey));
    if (!device) throw new UnauthorizedError("Invalid API key");
    if (!device.is_active) throw new UnauthorizedError("Inactive device");

    if (device.fridge_id.toLowerCase() !== data.fridge_id.toLowerCase()) {
      throw new ForbiddenError("Fridge mismatch");
    }

    const fridge = await this.fridgesRepo.findById(device.fridge_id);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== device.user_id) throw new ForbiddenError("Fridge mismatch");

    const telemetry = await this.repo.createTelemetryRecord({
      ...data,
      fridge_id: device.fridge_id,
    });
    await this.devicesRepo.touchLastUsed(device.id);
    await this.analyzeAndNotify(device.user_id, fridge.id, data);

    return telemetry;
  }

  async listTelemetry(userId: string, fridgeId: string, query: { limit: number; offset: number }) {
    const fridge = await this.fridgesRepo.findById(fridgeId);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");

    return this.repo.listTelemetry(fridgeId, query);
  }

  async getLatestTelemetry(userId: string, fridgeId: string) {
    const fridge = await this.fridgesRepo.findById(fridgeId);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");

    const telemetry = await this.repo.getLatestTelemetry(fridgeId);
    if (!telemetry) throw new NotFoundError("No telemetry data available for this fridge");

    return telemetry;
  }

  private async analyzeAndNotify(userId: string, fridgeId: string, data: TelemetryPayload): Promise<void> {
    const threshold = await this.repo.getActiveThreshold();
    if (!threshold) {
      logger.warn("No active telemetry threshold configured");
      return;
    }

    const violations: Array<{ type: string; title: string; message: string; severity: string }> = [];

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

    if (data.door_open) {
      violations.push({
        type: "STORAGE_CONDITION_ALERT",
        title: "Door open detected",
        message: `Fridge door is currently open (threshold: ${threshold.max_door_open_seconds} seconds)`,
        severity: "WARN",
      });
    }

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