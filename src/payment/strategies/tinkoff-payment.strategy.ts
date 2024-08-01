import { Injectable } from '@nestjs/common';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { Payment } from '../schemas/payment.schema';
import { PaymentStrategy, CreatePaymentData } from './payment-strategy.interface';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { TBankClient } from '@app/tbank-client';

@Injectable()
export class TBankPaymentStrategy implements PaymentStrategy {
  constructor(private readonly tBankClient: TBankClient, private readonly configService: ConfigService) {}

  async createPayment({ tariffPrice, paymentMonths, ...data }: CreatePaymentData): Promise<Payment> {
    const tariffDescription = data.limit <= 5000 ? 'с ограничением на ' + data.limit : 'без лимита на количество';
    const description = `Доступ к базе данных о кино сроком на ${paymentMonths} м., ${tariffDescription} обращений в сутки.`;

    const orderId = uuidv4();
    const amount = tariffPrice * paymentMonths;
    const productName = `Доступ к базе данных о кино, ${tariffDescription} обращений в сутки.`;

    const createPaymentResponse = await this.tBankClient.createPayment(orderId, amount, description, data.email, {
      name: productName,
      price: tariffPrice,
      quantity: paymentMonths,
      tax: '',
    });

    if (createPaymentResponse.ErrorCode != '0') {
      throw new Error(createPaymentResponse.Message);
    }

    return new Payment({
      ...data,
      orderId,
      paymentId: createPaymentResponse.PaymentId,
      amount: tariffPrice,
      paymentSystem: PaymentSystemEnum.TBANK,
      paymentAmount: Number(createPaymentResponse.Amount),
      paymentCurrency: 'RUB',
      url: createPaymentResponse.PaymentURL,
      monthCount: paymentMonths,
    });
  }

  async validateTransaction(paymentId: string): Promise<PaymentStatusEnum> {
    try {
      const data = await this.tBankClient.getPaymentInfo(paymentId);

      if (data.Status === 'CONFIRMED') {
        return PaymentStatusEnum.PAID;
      } else if (data.Status === 'CANCELED') {
        return PaymentStatusEnum.CANCELED;
      }
      return PaymentStatusEnum.PENDING;
    } catch (error) {
      return PaymentStatusEnum.FAILED;
    }
  }
}
