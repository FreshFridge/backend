import { Router } from "express";
import { authMiddleware } from "../../../middleware/authMiddleware";
import { validateBody } from "../../../middleware/validateBody";
import { IotDevicesService } from "./iotDevices.service";
import { createIotDeviceSchema } from "./iotDevices.validation";

const router = Router();
const service = new IotDevicesService();

router.get("/api/iot/devices", authMiddleware, async (req, res) => {
  const result = await service.list(req.user!.id);
  res.json(result);
});

router.post("/api/iot/devices", authMiddleware, validateBody(createIotDeviceSchema), async (req, res) => {
  const result = await service.create(req.user!.id, req.body);
  res.status(201).json(result);
});

export default router;