import { ForbiddenError, NotFoundError } from "../../utils/errors";
import { ProductsRepository } from "./products.repo";

export class ProductsService {
  private repo = new ProductsRepository();

  async create(userId: string, dto: any) {
    // тут у майбутньому можна додати перевірку, що fridge_id належить user
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
    return this.repo.update(current.id, patch);
  }

  async remove(userId: string, id: string) {
    await this.getById(userId, id);
    await this.repo.remove(id);
  }

  async expiring(userId: string, days: number) {
    return this.repo.expiring(userId, days);
  }
}
