import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "./auth.validation";
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

const getProfileHandler = async (req: any, res: any) => {
  const result = await service.getProfile(req.user!.id);
  res.json(result);
};

const updateProfileHandler = async (req: any, res: any) => {
  const result = await service.updateProfile(req.user!.id, req.body);
  res.json(result);
};

router.get("/api/auth/me", authMiddleware, getProfileHandler);
router.patch("/api/auth/me", authMiddleware, validateBody(updateProfileSchema), updateProfileHandler);
router.get("/api/users/profile", authMiddleware, getProfileHandler);
router.patch("/api/users/profile", authMiddleware, validateBody(updateProfileSchema), updateProfileHandler);
router.patch("/api/users/profile/password", authMiddleware, validateBody(changePasswordSchema), async (req, res) => {
  const result = await service.changePassword(req.user!.id, req.body);
  res.json(result);
});

export default router;
