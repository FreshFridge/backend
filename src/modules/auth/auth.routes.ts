import { Router } from "express";
import { validateBody } from "../../middleware/validateBody";
import { registerSchema, loginSchema } from "./auth.validation";
import { AuthService } from "./auth.service";

const router = Router();
const service = new AuthService();

router.post("/api/auth/register", validateBody(registerSchema), async (req, res) => {
  const result = await service.register(req.body);
  res.status(201).json(result);
});

router.post("/api/auth/login", validateBody(loginSchema), async (req, res) => {
  const result = await service.login(req.body);
  res.status(200).json(result);
});

export default router;
