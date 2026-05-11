import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { PublicAccessTokenError } from 'src/common/public-access-token/public-access-token.service';
import { SubmitDecisionsDto } from './dto/submit-decisions.dto';
import { PublicQuotationService } from './public-quotation.service';

@Controller('public/quotation')
export class PublicQuotationController {
  constructor(private readonly service: PublicQuotationService) {}

  @Get(':token')
  async get(@Param('token') token: string) {
    try {
      return await this.service.getPublicQuotation(token);
    } catch (err) {
      this.rethrowAsHttp(err);
    }
  }

  @Post(':token/decisions')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async submit(
    @Param('token') token: string,
    @Body() body: SubmitDecisionsDto,
    @Req() req: Request,
  ) {
    try {
      return await this.service.submitDecisions(token, body, {
        ip: this.extractIp(req),
        userAgent: req.headers['user-agent']?.toString() ?? '',
      });
    } catch (err) {
      this.rethrowAsHttp(err);
    }
  }

  private rethrowAsHttp(err: unknown): never {
    if (err instanceof PublicAccessTokenError) {
      const status =
        err.code === 'EXPIRED' ? 410 : err.code === 'ALREADY_USED' ? 409 : 404;
      throw new HttpException({ code: err.code }, status);
    }
    throw err;
  }

  private extractIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0].trim();
    }
    if (Array.isArray(xff) && xff.length > 0) {
      return xff[0].split(',')[0].trim();
    }
    return req.ip ?? '';
  }
}
