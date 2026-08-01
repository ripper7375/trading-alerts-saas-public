import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates a request body against a canonical Zod schema (from
 * `@trading-alerts/types` or a route-local schema file), preserving that
 * schema's own defaults/refinements/error messages exactly. Used per-route
 * via `@UsePipes(new ZodValidationPipe(schema))` — the LOW PORT dial's
 * "current code is ground truth" rule applies to validation logic too, and
 * some ported schemas (`AlertAttachZ`/`AlertUpdateZ`) carry default values
 * and cross-field `.refine()` checks that are the actual behavior to
 * preserve, not something to hand-translate into class-validator decorators.
 *
 * Registered per-route, not globally — `main.ts`'s global `ValidationPipe`
 * (class-validator based) stays the default for every other module; it
 * no-ops on a plain (non-class) parameter type, so the two don't conflict.
 *
 * @module common/pipes/zod-validation.pipe
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    let parsedValue = value;
    if (typeof parsedValue === 'string') {
      try {
        parsedValue = JSON.parse(parsedValue);
      } catch {
        // Keep original string if parsing fails
      }
    }

    const result = this.schema.safeParse(parsedValue);
    if (!result.success) {
      throw new BadRequestException({
        error: 'Invalid input',
        message: result.error.errors[0]?.message ?? 'Invalid request data',
        details: result.error.errors,
      });
    }
    return result.data;
  }
}
