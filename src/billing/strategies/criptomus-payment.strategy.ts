import { Injectable } from '@nestjs/common';

import { PaymentStrategy } from './payment.strategy';
import { CriptomusClient } from '@app/criptomus-client';
import { TariffDocument } from 'src/tariff/schemas/tariff.schema';
import { Payment } from '../schemas/payment.schema';

@Injectable()
export class CriptomusPaymentStrategy implements PaymentStrategy {
  constructor(private readonly criptomusClient: CriptomusClient) {}

  async execute(
    userId: number,
    chatId: number,
    tariff: TariffDocument,
    paymentMonths: number,
  ): Promise<Payment | undefined> {
    const amount = tariff.price * paymentMonths;
    const createPaymentResponse = await this.criptomusClient.createPayment(amount, chatId.toString());

    if (createPaymentResponse.state !== 0) {
      return undefined;
    }

    const payment = Payment.createPayment(
      userId,
      chatId,
      tariff._id.toString(),
      tariff.price,
      amount,
      createPaymentResponse,
      paymentMonths,
    );

    return payment;
  }
}
