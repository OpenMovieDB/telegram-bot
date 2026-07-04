import { Module } from '@nestjs/common';

import { PaymentService } from './payment.service';
import { TariffModule } from 'src/tariff/tariff.module';
import { BillingModule } from '../billing/billing.module';
import { AccountModule } from '../account/account.module';

@Module({
  imports: [TariffModule, BillingModule, AccountModule],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
