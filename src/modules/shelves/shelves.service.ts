import { ForbiddenError, NotFoundError } from "../../utils/errors";
import { FridgesRepository } from "../fridges/fridges.repo";
import { ShelvesRepository } from "./shelves.repo";

export class ShelvesService {
  private repo = new ShelvesRepository();
  private fridgesRepo = new FridgesRepository();

  async create(userId: string, fridgeId: string, dto: { name: string; position?: number | null }) {
    const fridge = await this.fridgesRepo.findById(fridgeId);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");

    return this.repo.create(fridgeId, dto);
  }

  async listByFridge(userId: string, fridgeId: string) {
    const fridge = await this.fridgesRepo.findById(fridgeId);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");

    return this.repo.listByFridge(fridgeId);
  }

  async getById(userId: string, id: string) {
    const shelf = await this.repo.findById(id);
    if (!shelf) throw new NotFoundError("Shelf not found");

    const fridge = await this.fridgesRepo.findById(shelf.fridge_id);
    if (!fridge) throw new NotFoundError("Fridge not found");
    if (fridge.user_id !== userId) throw new ForbiddenError("Shelf does not belong to user");

    return shelf;
  }

  async update(userId: string, id: string, patch: { name?: string; position?: number | null }) {
    await this.getById(userId, id);
    return this.repo.update(id, patch);
  }

  async remove(userId: string, id: string) {
    await this.getById(userId, id);
    await this.repo.softDeleteAndDetachProducts(id);
  }
}
