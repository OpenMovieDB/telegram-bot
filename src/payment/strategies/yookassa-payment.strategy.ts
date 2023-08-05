import { Injectable } from '@nestjs/common';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { Payment } from '../schemas/payment.schema';
import { PaymentStrategy, CreatePaymentData } from './payment-strategy.interface';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { YookassaClient } from '@app/yookassa-client';

@Injectable()
export class YookassaPaymentStrategy implements PaymentStrategy {
  constructor(private readonly yooMoneyClient: YookassaClient, private readonly configService: ConfigService) {}

  async createPayment({ tariffPrice, paymentMonths, ...data }: CreatePaymentData): Promise<Payment> {
    const tariffDescription = data.limit <= 5000 ? 'с ограничением на ' + data.limit : 'без лимита на количество';
    const comment = `Доступ к базе данных о кино сроком на ${paymentMonths} м., ${tariffDescription} обращений в сутки.`;
    const orderId = uuidv4();

    const createPaymentResponse = await this.yooMoneyClient.createPayment(
      tariffPrice,
      paymentMonths,
      orderId,
      data.email,
      comment,
    );

    const payment = new Payment({
      ...data,
      orderId,
      paymentId: createPaymentResponse.id,
      amount: tariffPrice,
      paymentSystem: PaymentSystemEnum.YOOKASSA,
      paymentAmount: Number(createPaymentResponse.amount.value),
      paymentCurrency: 'RUB',
      url: createPaymentResponse.confirmation.confirmation_url,
      monthCount: paymentMonths,
    });

    return payment;
  }

  async validateTransaction(paymentId: string): Promise<PaymentStatusEnum> {
    try {
      const data = await this.yooMoneyClient.getPaymentInfo(paymentId);

      if (data.status === 'succeeded') {
        return PaymentStatusEnum.PAID;
      }
      return PaymentStatusEnum.PENDING;
    } catch (error) {
      return PaymentStatusEnum.FAILED;
    }
  }
}
