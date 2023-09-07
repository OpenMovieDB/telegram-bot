import { CryptomusClientModule } from '@app/cryptomus-client';
import { Module, forwardRef } from '@nestjs/common';
import { Payment, PaymentSchema } from './schemas/payment.schema';

import { BotModule } from 'src/bot.module';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentScheduler } from './payment.scheduler';
import { PaymentService } from './payment.service';
import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
import { TariffModule } from 'src/tariff/tariff.module';
import { UserModule } from 'src/user/user.module';
import { YooMoneyClientModule } from '@app/yoomoney-client';
import { PaymentController } from './payment.controller';
import { YookassaClientModule } from '@app/yookassa-client';
import { WalletClientModule } from '@app/wallet-client';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    UserModule,
    TariffModule,
    CryptomusClientModule,
    YooMoneyClientModule,
    YookassaClientModule,
    WalletClientModule,
    forwardRef(() => BotModule),
  ],
  providers: [PaymentService, PaymentStrategyFactory, PaymentScheduler],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
