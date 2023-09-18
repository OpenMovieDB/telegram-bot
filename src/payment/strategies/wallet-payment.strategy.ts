import { Injectable } from '@nestjs/common';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { Payment } from '../schemas/payment.schema';
import { PaymentStrategy, CreatePaymentData } from './payment-strategy.interface';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { WalletClient } from '@app/wallet-client';
import { OrderStatus } from 'wallet-pay';

@Injectable()
export class WalletPaymentStrategy implements PaymentStrategy {
  constructor(private readonly walletClient: WalletClient, private readonly configService: ConfigService) {}

  async createPayment({ tariffPrice, paymentMonths, ...data }: CreatePaymentData): Promise<Payment> {
    const tariffDescription = data.limit <= 5000 ? 'с ограничением на ' + data.limit : 'без лимита на количество';
    const comment = `Доступ к базе данных о кино сроком на ${paymentMonths} м., ${tariffDescription} обращений в сутки.`;
    const orderId = uuidv4();

    const { data: createPaymentResponse } = await this.walletClient.createPayment(
      tariffPrice,
      paymentMonths,
      orderId,
      data.userId,
      comment,
    );

    const payment = new Payment({
      ...data,
      orderId,
      paymentId: createPaymentResponse.id.toString(),
      amount: tariffPrice,
      paymentSystem: PaymentSystemEnum.WALLET,
      paymentAmount: Number(createPaymentResponse.amount.amount),
      paymentCurrency: createPaymentResponse.amount.currencyCode,
      url: createPaymentResponse.directPayLink,
      monthCount: paymentMonths,
    });

    return payment;
  }

  async validateTransaction(paymentId: string): Promise<PaymentStatusEnum> {
    try {
      const { data } = await this.walletClient.getPaymentInfo(Number(paymentId));

      switch (data.status) {
        case OrderStatus.PAID:
          return PaymentStatusEnum.PAID;
        case OrderStatus.CANCELLED:
          return PaymentStatusEnum.CANCELED;
        case OrderStatus.EXPIRED:
          return PaymentStatusEnum.FAILED;
        case OrderStatus.ACTIVE:
          return PaymentStatusEnum.PENDING;
        default:
          return PaymentStatusEnum.PENDING;
      }
    } catch (error) {
      return PaymentStatusEnum.FAILED;
    }
  }
}
