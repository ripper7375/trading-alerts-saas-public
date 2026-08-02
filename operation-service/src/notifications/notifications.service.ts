import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { NotificationQueryDto } from './dto/notification.dto';

const LIST_SELECT = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  priority: true,
  read: true,
  readAt: true,
  link: true,
  createdAt: true,
} as const;

const FULL_SELECT = {
  ...LIST_SELECT,
  updatedAt: true,
} as const;

/**
 * Notifications CRUD — ports `app/api/notifications/route.ts` (196 lines),
 * `app/api/notifications/[id]/route.ts` (179 lines), and
 * `app/api/notifications/[id]/read/route.ts` (144 lines) verbatim.
 * Session 4B-9.
 *
 * `JwtAuthGuard` already guarantees an authenticated caller before any
 * method here runs. Uncaught errors fall through to the global
 * `AllExceptionsFilter` (Session 4B-4) as a 500, matching the SOURCE's own
 * per-route try/catch-and-500 (mechanism differs, observable behavior is
 * preserved) — same established convention as `AlertsService`/
 * `DrawingsService`.
 *
 * Three response-shape corrections against the migration order's own Step 1
 * paraphrase, made in favor of the real SOURCE files (ground truth wins over
 * an order's prose, per `LESSONS-LEARNED.md` L27) — recorded in this
 * order's Deviations: `markAllRead` returns `{ success, updatedCount,
 * message }`, not `{ success, count }`; `markRead`'s already-read branch
 * returns `{ notification, alreadyRead, message }` with NO `success` key
 * (matching SOURCE exactly), not `{ success, alreadyRead }`; and ownership
 * failures throw a 403 `ForbiddenException` (matching SOURCE and the
 * established Drawings/Alerts convention), not a blanket 404 for both
 * missing/not-owned as the order's own Rules section states.
 *
 * @module notifications/notifications.service
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: NotificationQueryDto) {
    const { status, type, page, pageSize } = query;

    const where: {
      userId: string;
      read?: boolean;
      type?: NotificationType;
    } = { userId };

    if (status === 'unread') {
      where.read = false;
    } else if (status === 'read') {
      where.read = true;
    }

    if (type) {
      where.type = type;
    }

    const total = await this.prisma.notification.count({ where });

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: LIST_SELECT,
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, read: false },
    });

    return {
      notifications,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      unreadCount,
    };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });

    return {
      success: true,
      updatedCount: result.count,
      message: `${result.count} notification(s) marked as read`,
    };
  }

  async getById(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: FULL_SELECT,
    });

    if (!notification) {
      throw new NotFoundException({
        error: 'Not found',
        message: 'Notification not found',
      });
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'You do not have permission to access this notification',
      });
    }

    return notification;
  }

  async remove(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!notification) {
      throw new NotFoundException({
        error: 'Not found',
        message: 'Notification not found',
      });
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'You do not have permission to delete this notification',
      });
    }

    await this.prisma.notification.delete({ where: { id } });

    return { success: true, message: 'Notification deleted successfully' };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, read: true },
    });

    if (!notification) {
      throw new NotFoundException({
        error: 'Not found',
        message: 'Notification not found',
      });
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'You do not have permission to update this notification',
      });
    }

    // Invariant (per the order's own Rules section): if already read, skip
    // the write entirely — never rewrite `readAt` for an already-read
    // notification.
    if (notification.read) {
      const existing = await this.prisma.notification.findUnique({
        where: { id },
        select: FULL_SELECT,
      });

      return {
        notification: existing,
        alreadyRead: true,
        message: 'Notification was already marked as read',
      };
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
      select: FULL_SELECT,
    });

    return {
      notification: updated,
      success: true,
      message: 'Notification marked as read',
    };
  }
}
