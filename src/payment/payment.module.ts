import { ConfigModule, ConfigService } from '@nestjs/config';
import { CryptomusClient, CryptomusClientModule } from '@app/cryptomus-client';
import { Module, forwardRef } from '@nestjs/common';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Tariff, TariffSchema } from 'src/tariff/schemas/tariff.schema';
import { User, UserSchema } from 'src/user/schemas/user.schema';

import { BOT_NAME } from 'src/constants/bot-name.const';
import { BotModule } from 'src/bot.module';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentScheduler } from './payment.scheduler';
import { PaymentService } from './payment.service';
import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
import { TariffModule } from 'src/tariff/tariff.module';
import { TelegrafModule } from 'nestjs-telegraf';
import { UserModule } from 'src/user/user.module';
import { UserService } from 'src/user/user.service';
import { session } from 'telegraf';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    UserModule,
    TariffModule,
    CryptomusClientModule,
    forwardRef(() => BotModule),
  ],
  providers: [PaymentService, PaymentStrategyFactory, PaymentScheduler],
  exports: [PaymentService],
})
export class PaymentModule {}
