import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/errors";
import { FridgesRepository } from "../fridges/fridges.repo";
import { ShelvesRepository } from "../shelves/shelves.repo";
import { ProductsRepository } from "./products.repo";

export class ProductsService {
  private repo = new ProductsRepository();
  private fridgesRepo = new FridgesRepository();
  private shelvesRepo = new ShelvesRepository();

  async create(userId: string, dto: any) {
    await this.validateFridgeAndShelf(userId, dto.fridge_id, dto.shelf_id);
    return this.repo.create(userId, dto);
  }

  async list(userId: string, query: any) {
    return this.repo.list(userId, query);
  }

  async getById(userId: string, id: string) {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError("Product not found");
    if (product.user_id !== userId) throw new ForbiddenError("Product does not belong to user");
    return product;
  }

  async update(userId: string, id: string, patch: any) {
    const current = await this.getById(userId, id);
    await this.validateFridgeAndShelf(userId, patch.fridge_id, patch.shelf_id);
    return this.repo.update(current.id, patch);
  }

  async remove(userId: string, id: string) {
    await this.getById(userId, id);
    await this.repo.remove(id);
  }

  async expiring(userId: string, days: number) {
    return this.repo.expiring(userId, days);
  }

  private async validateFridgeAndShelf(userId: string, fridgeId?: string | null, shelfId?: string | null) {
    if (fridgeId) {
      const fridge = await this.fridgesRepo.findById(fridgeId);
      if (!fridge) throw new BadRequestError("Fridge not found");
      if (fridge.user_id !== userId) throw new ForbiddenError("Fridge does not belong to user");
    }

    if (shelfId) {
      const shelf = await this.shelvesRepo.findById(shelfId);
      if (!shelf) throw new BadRequestError("Shelf not found");

      const fridge = await this.fridgesRepo.findById(shelf.fridge_id);
      if (!fridge) throw new BadRequestError("Shelf's fridge not found");
      if (fridge.user_id !== userId) throw new ForbiddenError("Shelf does not belong to user");
    }
  }
}
