import crypto from "crypto";
import { ForbiddenError, NotFoundError } from "../../../utils/errors";
import { FridgesRepository } from "../../fridges/fridges.repo";
import { IotDevicesRepository, type IotDeviceRow } from "./iotDevices.repo";

const API_KEY_PREFIX = "ff_iot_";

export type IotDeviceResponse = Omit<IotDeviceRow, "api_key_hash">;

export class IotDevicesService {
  private repo = new IotDevicesRepository();
  private fridgesRepo = new FridgesRepository();

  static hashApiKey(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex");
  }

  private static generateApiKey(): string {
    return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
  }

  private toResponse(device: IotDeviceRow): IotDeviceResponse {
    const { api_key_hash: _apiKeyHash, ...safeDevice } = device;
    void _apiKeyHash;
    return safeDevice;
  }

  async create(userId: string, data: { fridge_id: string; name?: string }) {
    const fridge = await this.fridgesRepo.findById(data.fridge_id);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");

    const apiKey = IotDevicesService.generateApiKey();
    const device = await this.repo.create({
      user_id: userId,
      fridge_id: fridge.id,
      name: data.name?.trim() || `${fridge.name} IoT device`,
      api_key_hash: IotDevicesService.hashApiKey(apiKey),
      api_key_prefix: apiKey.slice(0, 14),
    });

    return { ...this.toResponse(device), api_key: apiKey };
  }

  async list(userId: string): Promise<IotDeviceResponse[]> {
    const devices = await this.repo.listByUser(userId);
    return devices.map((device) => this.toResponse(device));
  }
}