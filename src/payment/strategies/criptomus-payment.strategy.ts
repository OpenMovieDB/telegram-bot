import { CryptomusClient } from '@app/cryptomus-client';
import { Injectable } from '@nestjs/common';
import { Payment } from '../schemas/payment.schema';
import { PaymentStrategy } from './payment-strategy.interface';
import { PaymentSystemEnum } from '../enum/payment-system.enum';

@Injectable()
export class CryptomusPaymentStrategy implements PaymentStrategy {
  constructor(private readonly cryptomusClient: CryptomusClient) {}

  async createPayment(data: {
    userId: number;
    chatId: number;
    tariffId: string;
    tariffPrice: number;
    paymentMonths: number;
  }): Promise<Payment> {
    const { userId, chatId, tariffId, tariffPrice, paymentMonths } = data;

    const paymentAmount = tariffPrice * paymentMonths;
    const createPaymentResponse = await this.cryptomusClient.createPayment(paymentAmount, `User #${userId} payment`);

    const payment = new Payment({
      userId,
      chatId,
      tariffId,
      amount: tariffPrice,
      paymentSystem: PaymentSystemEnum.CYPTOMUS,
      paymentAmount,
      paymentCurrency: createPaymentResponse.result.payer_currency,
      url: createPaymentResponse.result.url,
      monthCount: paymentMonths,
      transactionId: createPaymentResponse.result.txid,
      payerAmount: createPaymentResponse.result.payer_amount,
      payerCurrency: createPaymentResponse.result.payer_currency,
      network: createPaymentResponse.result.network,
      address: createPaymentResponse.result.address,
      from: createPaymentResponse.result.from,
      txid: createPaymentResponse.result.txid,
      isFinal: createPaymentResponse.result.is_final,
    });

    return payment;
  }

  async validateTransaction(paymentId: string): Promise<boolean> {
    const transaction = await this.cryptomusClient.checkPaymentStatus(paymentId);

    const paymentStatus = transaction.result.payment_status;

    return Boolean(paymentStatus === 'paid');
  }
}
