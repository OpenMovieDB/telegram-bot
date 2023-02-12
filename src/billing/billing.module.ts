import { CriptomusClient, CriptomusClientModule } from '@app/criptomus-client';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Tariff, TariffSchema } from 'src/tariff/schemas/tariff.schema';
import { User, UserSchema } from 'src/user/schemas/user.schema';

import { BillingService } from './billing.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
import { TariffModule } from 'src/tariff/tariff.module';
import { UserModule } from 'src/user/user.module';
import { UserService } from 'src/user/user.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    UserModule,
    TariffModule,
    CriptomusClientModule,
  ],
  providers: [BillingService, PaymentStrategyFactory],
  exports: [BillingService],
})
export class BillingModule {}
