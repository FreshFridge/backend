import { ForbiddenError, NotFoundError } from "../../utils/errors";
import { NotificationsRepository } from "./notifications.repo";

export class NotificationsService {
  private repo = new NotificationsRepository();

  async create(userId: string, dto: {
    type: string;
    title: string;
    message: string;
    related_entity_type?: string | null;
    related_entity_id?: string | null;
    severity: string;
  }) {
    return this.repo.create(userId, dto);
  }

  async list(userId: string, query: {
    isRead?: boolean;
    type?: string;
    limit: number;
    offset: number;
  }) {
    return this.repo.list(userId, query);
  }

  async getById(userId: string, id: string) {
    const notification = await this.repo.findById(id);
    if (!notification) throw new NotFoundError("Notification not found");
    if (notification.user_id !== userId) throw new ForbiddenError("Notification does not belong to user");
    return notification;
  }

  async markRead(userId: string, id: string) {
    await this.getById(userId, id);
    return this.repo.markRead(userId, id);
  }

  async markAllRead(userId: string) {
    return this.repo.markAllRead(userId);
  }

  async remove(userId: string, id: string) {
    await this.getById(userId, id);
    await this.repo.softDelete(userId, id);
  }
}
