import { CriptomusClient } from '@app/criptomus-client';
import { Injectable } from '@nestjs/common';
import { BillingService } from 'src/billing/billing.service';
import { PaymentSystemEnum } from 'src/billing/enum/payment-system.enum';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';
import { CriptomusPaymentStrategy } from '../criptomus-payment.strategy';
import { PaymentStrategy } from '../payment-strategy.interface';

@Injectable()
export class PaymentStrategyFactory {
  constructor(
    private readonly billingService: BillingService,
    private readonly tariffService: TariffService,
    private readonly userService: UserService,
    private readonly criptomusClient: CriptomusClient,
  ) {}

  createPaymentStrategy(paymentSystem: PaymentSystemEnum): PaymentStrategy {
    switch (paymentSystem) {
      case PaymentSystemEnum.CYPTOMUS:
        return new CriptomusPaymentStrategy(
          this.billingService,
          this.tariffService,
          this.userService,
          this.criptomusClient,
        );
      default:
        throw new Error(`Unsupported payment system: ${paymentSystem}`);
    }
  }
}
