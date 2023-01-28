import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';

@Module({
  providers: [BillingService],
})
export class BillingModule {}
