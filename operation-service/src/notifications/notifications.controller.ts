import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { notificationQuerySchema } from './notifications.schemas';
import { NotificationsService } from './notifications.service';
import type { NotificationQueryDto } from './dto/notification.dto';

/**
 * Notifications CRUD — ports `app/api/notifications/route.ts`,
 * `app/api/notifications/[id]/route.ts`, and
 * `app/api/notifications/[id]/read/route.ts`. Session 4B-9.
 *
 * L45 rule: `ZodValidationPipe` is applied at PARAMETER level only
 * (`@Query(new ZodValidationPipe(schema))`), never via a method-level
 * `@UsePipes()` — a method-level pipe validates every handler parameter,
 * including `@Param('id')`, which breaks on `:id` routes (the exact bug
 * that took down Alerts CRUD in production for ~5h in Session 4B-7).
 *
 * @module notifications/notifications.controller
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(notificationQuerySchema))
    query: NotificationQueryDto
  ) {
    return this.notificationsService.list(request.user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async markAllRead(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationsService.getById(request.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationsService.remove(request.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/read')
  async markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string
  ) {
    return this.notificationsService.markRead(request.user.id, id);
  }
}
