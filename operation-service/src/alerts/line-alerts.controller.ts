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
import { AlertAttachZ, AlertUpdateZ } from '@trading-alerts/types/validations';

import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AttachLineAlertDto, UpdateLineAlertDto } from './dto/alert.dto';
import { LineAlertsService } from './line-alerts.service';

/**
 * Line-touch (drawing-engine) alerts CRUD — ports
 * `app/api/alerts/line/route.ts` (File 3/4) and
 * `app/api/alerts/line/[id]/route.ts` (File 4/4). Session 4B-5.
 *
 * @module alerts/line-alerts.controller
 */
@Controller('alerts/line')
export class LineAlertsController {
  constructor(private readonly lineAlertsService: LineAlertsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('symbol') symbol?: string,
    @Query('timeframe') timeframe?: string
  ) {
    return this.lineAlertsService.list(request.user.id, {
      symbol,
      timeframe,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UsePipes(new ZodValidationPipe(AlertAttachZ))
  async attach(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AttachLineAlertDto
  ) {
    return this.lineAlertsService.attach(
      request.user.id,
      request.user.tier,
      dto
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UsePipes(new ZodValidationPipe(AlertUpdateZ))
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateLineAlertDto
  ) {
    return this.lineAlertsService.update(
      request.user.id,
      request.user.tier,
      id,
      dto
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.lineAlertsService.remove(request.user.id, id);
  }
}
