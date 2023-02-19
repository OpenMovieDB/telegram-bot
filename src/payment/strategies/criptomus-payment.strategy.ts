import { CryptomusClient } from '@app/cryptomus-client';
import { Injectable } from '@nestjs/common';
import { Payment } from '../schemas/payment.schema';
import { CreatePaymentData, PaymentStrategy } from './payment-strategy.interface';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
@Injectable()
export class CryptomusPaymentStrategy implements PaymentStrategy {
  constructor(private readonly cryptomusClient: CryptomusClient) {}

  async createPayment({ tariffPrice, paymentMonths, ...data }: CreatePaymentData): Promise<Payment> {
    const paymentAmount = tariffPrice * paymentMonths;
    const createPaymentResponse = await this.cryptomusClient.createPayment(paymentAmount, uuidv4());

    const payment = new Payment({
      ...data,
      orderId: createPaymentResponse.result.order_id,
      paymentId: createPaymentResponse.result.uuid,
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

  async validateTransaction(paymentId: string): Promise<PaymentStatusEnum> {
    const transaction = await this.cryptomusClient.checkPaymentStatus(paymentId);
    const paymentStatus = transaction.result.payment_status;

    if (paymentStatus === 'paid') return PaymentStatusEnum.PAID;
    const nowAt = DateTime.local({ zone: 'utc' }).toUnixInteger();
    const isExpired = nowAt >= transaction.result.expired_at;

    if (isExpired) return PaymentStatusEnum.CANCELED;

    return PaymentStatusEnum.PENDING;
  }
}
