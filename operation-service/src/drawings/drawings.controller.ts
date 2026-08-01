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
} from '@nestjs/common';

import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createDrawingSchema, updateDrawingSchema } from './drawings.schemas';
import { DrawingsService } from './drawings.service';
import type { CreateDrawingDto, UpdateDrawingDto } from './dto/drawing.dto';

/**
 * Chart drawings CRUD — ports `app/api/drawings/route.ts` and
 * `app/api/drawings/[id]/route.ts`. Session 4B-8.
 *
 * L45 rule: `ZodValidationPipe` is applied at PARAMETER level only
 * (`@Body(new ZodValidationPipe(schema))`), never via a method-level
 * `@UsePipes()` — a method-level pipe validates every handler parameter,
 * including `@Param('id')`, which breaks on `:id` routes (the exact bug
 * that took down Alerts CRUD in production for ~5h in Session 4B-7).
 *
 * @module drawings/drawings.controller
 */
@Controller('drawings')
export class DrawingsController {
  constructor(private readonly drawingsService: DrawingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('symbol') symbol?: string,
    @Query('timeframe') timeframe?: string
  ) {
    return this.drawingsService.list(request.user.id, { symbol, timeframe });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createDrawingSchema)) dto: CreateDrawingDto
  ) {
    return this.drawingsService.create(request.user.id, request.user.tier, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDrawingSchema)) dto: UpdateDrawingDto
  ) {
    return this.drawingsService.update(request.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.drawingsService.remove(request.user.id, id);
  }
}
