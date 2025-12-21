import { ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors";
import { FridgesRepository } from "./fridges.repo";

export class FridgesService {
  private repo = new FridgesRepository();

  async create(userId: string, dto: { name: string; description?: string | null }) {
    return this.repo.create(userId, dto);
  }

  async list(userId: string) {
    return this.repo.listByUser(userId);
  }

  async getById(userId: string, id: string) {
    const fridge = await this.repo.findById(id);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");
    return fridge;
  }

  async update(userId: string, id: string, patch: { name?: string; description?: string | null }) {
    await this.getById(userId, id);
    return this.repo.update(id, patch);
  }

  async remove(userId: string, id: string) {
    await this.getById(userId, id);

    const hasData = await this.repo.hasShelvesOrProducts(id);
    if (hasData) {
      throw new ConflictError("Cannot delete fridge: it contains shelves or products");
    }

    await this.repo.softDelete(id);
  }
}
