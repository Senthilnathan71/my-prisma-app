import { Module } from '@nestjs/common';
import { PublicQuotationController } from './public-quotation.controller';
import { PublicQuotationService } from './public-quotation.service';

@Module({
  controllers: [PublicQuotationController],
  providers: [PublicQuotationService],
})
export class PublicQuotationModule {}
