import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import { registerSchema, loginSchema, updateProfileSchema } from "./auth.validation";
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



router.get("/api/auth/me", authMiddleware, async (req, res) => {
  const result = await service.getProfile(req.user!.id);
  res.json(result);
});

router.patch("/api/auth/me", authMiddleware, validateBody(updateProfileSchema), async (req, res) => {
  const result = await service.updateProfile(req.user!.id, req.body);
  res.json(result);
});
export default router;
