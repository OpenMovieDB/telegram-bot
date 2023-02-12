import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
@Injectable()
export class BillingService {
  constructor(@InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>) {}

  async createPayment(
    userId: number,
    chatId: number,
    tariffId: string,
    tariffPrice: number,
    paymentAmount: number,
    createPaymentResponse: any,
    paymentMonths: number,
  ): Promise<Payment> {
    const payment = Payment.createPayment(
      userId,
      chatId,
      tariffId,
      tariffPrice,
      paymentAmount,
      createPaymentResponse,
      paymentMonths,
    );
    return this.paymentModel.create(payment);
  }

  async getPendingPayments(): Promise<Payment[]> {
    return this.paymentModel.find({ status: 'pending' }).exec();
  }

  async updatePaymentStatus(id: string, status: string): Promise<void> {
    await this.paymentModel.updateOne({ _id: id }, { status: status }).exec();
  }

  async findPaymentById(id: string): Promise<Payment> {
    return this.paymentModel.findById(id).exec();
  }
}
