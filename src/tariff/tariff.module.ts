import { Module } from '@nestjs/common';
import { BillingModule } from 'src/billing/billing.module';
import { TariffService } from './tariff.service';

@Module({
  imports: [BillingModule],
  providers: [TariffService],
  exports: [TariffService],
})
export class TariffModule {}
