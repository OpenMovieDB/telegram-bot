import { Injectable } from '@nestjs/common';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { PaymentStrategy } from './payment-strategy.interface';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { v4 as uuidv4 } from 'uuid';
import { Model } from 'mongoose';

@Injectable()
export class CashPaymentStrategy implements PaymentStrategy {
  constructor(private readonly paymentModel: Model<PaymentDocument>) {}

  async createPayment(data: {
    userId: number;
    chatId: number;
    tariffId: string;
    tariffPrice: number;
    paymentMonths: number;
  }): Promise<Payment> {
    const { userId, chatId, tariffId, tariffPrice, paymentMonths } = data;

    const paymentAmount = tariffPrice * paymentMonths;

    const payment = new Payment({
      orderId: uuidv4(),
      paymentId: uuidv4(),
      userId,
      chatId,
      tariffId,
      amount: tariffPrice,
      paymentSystem: PaymentSystemEnum.CASH,
      paymentAmount,
      monthCount: paymentMonths,
      isFinal: false,
    });

    return payment;
  }

  async validateTransaction(paymentId: string): Promise<boolean> {
    const transaction = await this.paymentModel.findOne({ paymentId });

    return transaction.isFinal;
  }
}
