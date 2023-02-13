import { CriptomusClient } from '@app/criptomus-client';
import { CriptomusPaymentStrategy } from '../criptomus-payment.strategy';
import { Injectable } from '@nestjs/common';
import { PaymentStrategy } from '../payment-strategy.interface';
import { PaymentSystemEnum } from 'src/payment/enum/payment-system.enum';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class PaymentStrategyFactory {
  constructor(
    private readonly tariffService: TariffService,
    private readonly userService: UserService,
    private readonly criptomusClient: CriptomusClient,
  ) {}

  createPaymentStrategy(paymentSystem: PaymentSystemEnum): PaymentStrategy {
    switch (paymentSystem) {
      case PaymentSystemEnum.CYPTOMUS:
        return new CriptomusPaymentStrategy(this.tariffService, this.userService, this.criptomusClient);
      default:
        throw new Error(`Unsupported payment system: ${paymentSystem}`);
    }
  }
}
