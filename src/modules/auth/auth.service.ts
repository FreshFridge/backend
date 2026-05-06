import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthRepository } from "./auth.repo";
import { ConflictError, UnauthorizedError } from "../../utils/errors";

export class AuthService {
  private repo = new AuthRepository();

  async register(dto: {
    email: string;
    password: string;
    full_name: string;
    locale: string;
    timezone: string;
  }) {
    const exists = await this.repo.findByEmail(dto.email);
    if (exists) throw new ConflictError("Email already registered");

    const password_hash = await bcrypt.hash(dto.password, 10);

    const user = await this.repo.createUser({
      email: dto.email,
      password_hash,
      full_name: dto.full_name,
      locale: dto.locale,
      timezone: dto.timezone,
    });

    const accessToken = this.signAccessToken(user.id, user.email, "user");
    return { user, accessToken };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.repo.findByEmail(dto.email);
    if (!user) throw new UnauthorizedError("Invalid credentials");
    if (!user.is_active) throw new UnauthorizedError("User is inactive");
    if (user.is_blocked) throw new UnauthorizedError("User is blocked");

    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) throw new UnauthorizedError("Invalid credentials");

    const accessToken = this.signAccessToken(user.id, user.email, user.role);
    return {
      user: this.toPublicUser(user),
      accessToken,
    };
  }

  async getProfile(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user) throw new UnauthorizedError("User not found");

    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, dto: { full_name?: string; locale?: string; timezone?: string }) {
    return this.repo.updateProfile(userId, dto);
  }

  async changePassword(userId: string, dto: { old_password: string; new_password: string }) {
    const user = await this.repo.findById(userId);
    if (!user) throw new UnauthorizedError("User not found");

    const ok = await bcrypt.compare(dto.old_password, user.password_hash);
    if (!ok) throw new UnauthorizedError("Current password is incorrect");

    const passwordHash = await bcrypt.hash(dto.new_password, 10);
    await this.repo.updatePassword(userId, passwordHash);

    return { success: true };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    full_name: string;
    locale: string;
    timezone: string;
    is_active: boolean;
    role: string;
    created_at: Date | string;
  }) {
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      locale: user.locale,
      timezone: user.timezone,
      is_active: user.is_active,
      role: user.role,
      created_at: user.created_at,
    };
  }

  private signAccessToken(id: string, email: string, role: string) {
    const secret = process.env.JWT_ACCESS_SECRET as jwt.Secret;
    const expiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ?? "15m") as jwt.SignOptions["expiresIn"];

    return jwt.sign({ id, email, role }, secret, { expiresIn });
  }
}
