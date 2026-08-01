import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  createPlainAlertSchema,
  updatePlainAlertSchema,
} from './alerts.schemas';
import { AlertsService } from './alerts.service';
import type { CreateAlertDto, UpdateAlertDto } from './dto/alert.dto';

/**
 * Plain (price) alerts CRUD — ports `app/api/alerts/route.ts` (File 1/4) and
 * `app/api/alerts/[id]/route.ts` (File 2/4). Session 4B-5.
 *
 * @module alerts/alerts.controller
 */
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('symbol') symbol?: string
  ) {
    return this.alertsService.list(request.user.id, { status, symbol });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UsePipes(new ZodValidationPipe(createPlainAlertSchema))
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAlertDto
  ) {
    return this.alertsService.create(request.user.id, request.user.tier, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.alertsService.getById(request.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updatePlainAlertSchema))
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto
  ) {
    return this.alertsService.update(
      request.user.id,
      request.user.tier,
      id,
      dto
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.alertsService.remove(request.user.id, id);
  }
}
