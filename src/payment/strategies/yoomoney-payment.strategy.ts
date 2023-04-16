import { YooMoneyClient } from '@app/yoomoney-client';
import { Injectable } from '@nestjs/common';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { Payment } from '../schemas/payment.schema';
import { PaymentStrategy, CreatePaymentData } from './payment-strategy.interface';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class YooMoneyPaymentStrategy implements PaymentStrategy {
  constructor(private readonly yooMoneyClient: YooMoneyClient, private readonly configService: ConfigService) {}

  async createPayment({ tariffPrice, paymentMonths, ...data }: CreatePaymentData): Promise<Payment> {
    const paymentAmount = tariffPrice * paymentMonths;
    const comment = `Payment for ${paymentMonths} months, userId: ${data.userId}, chatId: ${data.chatId}`;
    const paymentId = uuidv4();

    const form = this.yooMoneyClient.generatePaymentForm(paymentAmount, paymentId, comment);
    const url = `${this.configService.get('DOMAIN')}/payment/${paymentId}`;

    const payment = new Payment({
      ...data,
      paymentId,
      amount: tariffPrice,
      paymentSystem: PaymentSystemEnum.YOOMONEY,
      paymentAmount,
      paymentCurrency: 'RUB',
      url,
      form,
      monthCount: paymentMonths,
    });

    return payment;
  }

  async validateTransaction(paymentId: string): Promise<PaymentStatusEnum> {
    try {
      const { operations } = await this.yooMoneyClient.getOperationHistory({ label: paymentId });
      if (!operations.length) return PaymentStatusEnum.PENDING;

      const { status } = operations[0];

      if (status === 'success') {
        return PaymentStatusEnum.PAID;
      }
      return PaymentStatusEnum.PENDING;
    } catch (error) {
      return PaymentStatusEnum.FAILED;
    }
  }
}
