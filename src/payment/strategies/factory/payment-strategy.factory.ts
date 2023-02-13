import { CryptomusClient } from '@app/cryptomus-client';
import { CryptomusPaymentStrategy } from '../criptomus-payment.strategy';
import { Injectable } from '@nestjs/common';
import { PaymentStrategy } from '../payment-strategy.interface';
import { PaymentSystemEnum } from 'src/payment/enum/payment-system.enum';

@Injectable()
export class PaymentStrategyFactory {
  constructor(private readonly cryptomusClient: CryptomusClient) {}

  createPaymentStrategy(paymentSystem: PaymentSystemEnum): PaymentStrategy {
    switch (paymentSystem) {
      case PaymentSystemEnum.CYPTOMUS:
        return new CryptomusPaymentStrategy(this.cryptomusClient);
      default:
        throw new Error(`Unsupported payment system: ${paymentSystem}`);
    }
  }
}
