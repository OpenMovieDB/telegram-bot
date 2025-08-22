import { Injectable } from '@nestjs/common';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { CreatePaymentData, PaymentStrategy } from './payment-strategy.interface';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { v4 as uuidv4 } from 'uuid';
import { Model } from 'mongoose';
import { PaymentStatusEnum } from '../enum/payment-status.enum';

@Injectable()
export class CashPaymentStrategy implements PaymentStrategy {
  constructor(private readonly paymentModel: Model<PaymentDocument>) {}

  async createPayment({ tariffPrice, paymentMonths, ...data }: CreatePaymentData): Promise<Payment> {
    const paymentAmount = tariffPrice * paymentMonths;

    const payment = new Payment({
      ...data,
      orderId: uuidv4(),
      paymentId: uuidv4(),
      amount: tariffPrice,
      paymentSystem: PaymentSystemEnum.CASH,
      paymentAmount,
      monthCount: paymentMonths,
      isFinal: false,
    });

    return payment;
  }

  async validateTransaction(paymentId: string): Promise<PaymentStatusEnum> {
    const transaction = await this.paymentModel.findOne({ paymentId });

    if (!transaction) {
      return PaymentStatusEnum.FAILED;
    }

    // For CASH payments, check the actual status in the database
    // Admin confirms payment by setting status to PAID
    return transaction.status as PaymentStatusEnum;
  }
}
