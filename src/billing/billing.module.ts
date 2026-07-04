import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { BillingClient } from './billing.client';

@Module({
  imports: [HttpModule],
  providers: [BillingClient],
  exports: [BillingClient],
})
export class BillingModule {}
