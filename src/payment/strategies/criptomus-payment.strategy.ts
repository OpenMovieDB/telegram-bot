import { CriptomusClient } from '@app/criptomus-client';
import { Injectable } from '@nestjs/common';
import { Payment } from '../schemas/payment.schema';
import { PaymentStrategy } from './payment-strategy.interface';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { TariffService } from 'src/tariff/tariff.service';

@Injectable()
export class CriptomusPaymentStrategy implements PaymentStrategy {
  constructor(private readonly tariffService: TariffService, private readonly criptomusClient: CriptomusClient) {}

  async createPayment(userId: number, chatId: number, tariffId: string, paymentMonths: number): Promise<Payment> {
    const tariff = await this.tariffService.getOneById(tariffId);
    if (!tariff) throw new Error(`Tariff with id ${tariffId} not found`);

    const paymentAmount = tariff.price * paymentMonths;
    const createPaymentResponse = await this.criptomusClient.createPayment(paymentAmount, `User #${userId} payment`);

    return Payment.createPayment(
      userId,
      chatId,
      tariffId,
      tariff.price,
      PaymentSystemEnum.CYPTOMUS,
      paymentAmount,
      createPaymentResponse,
      paymentMonths,
    );
  }

  async validateTransaction(paymentId: string): Promise<boolean> {
    const transaction = await this.criptomusClient.checkPaymentStatus(paymentId);

    const paymentStatus = transaction.result.payment_status;

    return Boolean(paymentStatus === 'paid');
  }
}
