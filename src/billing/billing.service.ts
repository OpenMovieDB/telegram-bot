import { Payment, PaymentDocument } from './schemas/payment.schema';

import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';

import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
import { PaymentSystemEnum } from './enum/payment-system.enum';
import { Tariff } from 'src/tariff/schemas/tariff.schema';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
    private readonly paymentStrategyFactory: PaymentStrategyFactory,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {}

  async createPayment(
    userId: number,
    chatId: number,
    tariffId: string,
    paymentSystem: PaymentSystemEnum,
    paymentMonths: number,
  ): Promise<Payment> {
    const user = await this.userService.findOneByUserId(userId);

    if (!user) throw new Error('User not found');

    const tariff: Tariff = await this.tariffService.getOneById(tariffId);

    if (!tariff) throw new Error('Tariff not found');

    const paymentStrategy = this.paymentStrategyFactory.createPaymentStrategy(paymentSystem);

    const payment = await paymentStrategy.createPayment(userId, chatId, tariffId, paymentMonths);

    return payment;
  }

  async getPendingPayments(): Promise<Payment[]> {
    return this.paymentModel.find({ status: 'pending' }).exec();
  }

  async updatePaymentStatus(id: string, status: string, isFinal: boolean): Promise<void> {
    await this.paymentModel.updateOne({ _id: id }, { status, isFinal }).exec();
  }

  async findPaymentById(id: string): Promise<Payment> {
    return this.paymentModel.findById(id).exec();
  }

  async validatePayment(paymentId: string): Promise<boolean> {
    const payment = await this.paymentModel.findById(paymentId).exec();
    if (!payment) throw new Error(`Payment with id ${paymentId} not found`);

    const paymentStrategy = this.paymentStrategyFactory.createPaymentStrategy(payment.paymentSystem);

    return paymentStrategy.validateTransaction(paymentId);
  }
}
