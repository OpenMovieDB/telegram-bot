import { CryptomusClient } from '@app/cryptomus-client';
import { CryptomusPaymentStrategy } from '../criptomus-payment.strategy';
import { Injectable } from '@nestjs/common';
import { PaymentStrategy } from '../payment-strategy.interface';
import { PaymentSystemEnum } from 'src/payment/enum/payment-system.enum';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from 'src/payment/schemas/payment.schema';
import { CashPaymentStrategy } from '../cash-payment.strategy';
import { YooMoneyPaymentStrategy } from '../yoomoney-payment.strategy';
import { YooMoneyClient } from '@app/yoomoney-client';
import { ConfigService } from '@nestjs/config';
import { YookassaPaymentStrategy } from '../yookassa-payment.strategy';
import { YookassaClient } from '@app/yookassa-client';

@Injectable()
export class PaymentStrategyFactory {
  constructor(
    private readonly cryptomusClient: CryptomusClient,
    private readonly yooMoneyClient: YooMoneyClient,
    private readonly yookassaClient: YookassaClient,
    private readonly configService: ConfigService,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  createPaymentStrategy(paymentSystem: PaymentSystemEnum): PaymentStrategy {
    switch (paymentSystem) {
      case PaymentSystemEnum.YOOMONEY:
        return new YooMoneyPaymentStrategy(this.yooMoneyClient, this.configService);
      case PaymentSystemEnum.YOOKASSA:
        return new YookassaPaymentStrategy(this.yookassaClient, this.configService);
      case PaymentSystemEnum.CYPTOMUS:
        return new CryptomusPaymentStrategy(this.cryptomusClient);
      case PaymentSystemEnum.CASH:
        return new CashPaymentStrategy(this.paymentModel);
      default:
        throw new Error(`Unsupported payment system: ${paymentSystem}`);
    }
  }
}
