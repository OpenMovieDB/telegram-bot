import { Payment, PaymentDocument } from './schemas/payment.schema';

import { InjectModel } from '@nestjs/mongoose';
import { Injectable, Logger } from '@nestjs/common';
import mongoose, { Model } from 'mongoose';

import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
import { PaymentSystemEnum } from './enum/payment-system.enum';
import { Tariff } from 'src/tariff/schemas/tariff.schema';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';
import { PaymentStatusEnum } from './enum/payment-status.enum';
import { DateTime } from 'luxon';
import { YooMoneyNotification } from '@app/update-client/types/notification.type';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { YooMoneyClient } from '@app/yoomoney-client';
import * as ApiKey from 'uuid-apikey';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
    private readonly paymentStrategyFactory: PaymentStrategyFactory,
    private readonly yooMoney: YooMoneyClient,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async createPayment(
    userId: number,
    chatId: number,
    tariffId: string,
    paymentSystem: PaymentSystemEnum,
    paymentMonths: number,
    email?: string,
    paymentAt?: Date,
  ): Promise<Payment> {
    const user = await this.userService.findOneByUserId(userId);

    if (!user) throw new Error('User not found');
    if (!user?.chatId) await this.userService.update(user.userId, { chatId });

    const tariff: Tariff = await this.tariffService.getOneById(tariffId);
    if (!tariff) throw new Error(`Tariff with id ${tariffId} not found`);

    const paymentStrategy = this.paymentStrategyFactory.createPaymentStrategy(paymentSystem);
    const payment = await paymentStrategy.createPayment({
      userId,
      chatId,
      tariffId,
      tariffPrice: tariff.price,
      paymentMonths,
      email,
      paymentAt: paymentAt || DateTime.local().toJSDate(),
      limit: tariff.requestsLimit,
    });
    return this.paymentModel.create(payment);
  }

  async getPendingPayments(): Promise<Payment[]> {
    return this.paymentModel.find({ status: PaymentStatusEnum.PENDING }).exec();
  }

  async updatePaymentStatus(paymentId: string, status: string, isFinal: boolean): Promise<void> {
    await this.paymentModel.updateOne({ paymentId }, { status, isFinal }).exec();
  }

  async findPaymentById(id: string): Promise<Payment> {
    return this.paymentModel.findById(id).exec();
  }

  async validatePayment(paymentId: string): Promise<boolean> {
    const payment = await this.paymentModel.findOne({ paymentId }).exec();
    if (!payment) throw new Error(`Payment with id ${paymentId} not found`);

    const paymentStrategy = this.paymentStrategyFactory.createPaymentStrategy(payment.paymentSystem);

    const paymentStatus = await paymentStrategy.validateTransaction(payment.paymentId);
    const isPaid = paymentStatus === PaymentStatusEnum.PAID;

    if (isPaid) {
      const startAt = DateTime.fromJSDate(payment.paymentAt);
      const expiredAt = startAt.plus({ months: payment.monthCount });

      const user = await this.userService.findOneByUserId(payment.userId);

      if (user) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const key = ApiKey.toAPIKey(user.token);
        await this.redis.del(key);

        await this.userService.update(user.userId, {
          tariffId: new mongoose.Types.ObjectId(payment.tariffId),
          requestsUsed: 0,
          subscriptionStartDate: startAt.toJSDate(),
          subscriptionEndDate: expiredAt.toJSDate(),
        });
      }

      this.logger.debug(`Change status for ${paymentId} on ${paymentStatus}. IsPaid: ${isPaid}`);
      await this.updatePaymentStatus(paymentId, PaymentStatusEnum.PAID, isPaid);
    } else {
      if (paymentStatus !== payment.status) {
        this.logger.debug(`Change status for ${paymentId} on ${paymentStatus}, IsPaid: ${isPaid}`);
        await this.updatePaymentStatus(paymentId, paymentStatus, isPaid);
      }
    }

    return isPaid;
  }

  async getPaymentForm(paymentId: string): Promise<string> {
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) throw new Error(`Payment with id ${paymentId} not found`);

    return payment.form;
  }

  async yooMoneyWebHook({
    operation_id,
    notification_type,
    datetime,
    sha1_hash,
    sender,
    codepro,
    currency,
    amount,
    label,
  }: YooMoneyNotification): Promise<boolean> {
    const secret = this.configService.get('YOOMONEY_SECRET');

    const hashString = [
      notification_type,
      operation_id,
      amount,
      currency,
      datetime,
      sender,
      codepro,
      secret,
      label,
    ].join('&');
    const calculatedHash = createHash('sha1').update(hashString).digest('hex');

    if (calculatedHash !== sha1_hash) return false;

    const operationDetails = await this.yooMoney.getOperationDetails(operation_id);
    if (
      operationDetails.operation_id === operation_id &&
      operationDetails.amount === parseFloat(amount) &&
      operationDetails.sender === sender &&
      operationDetails.label === label
    ) {
      await this.updatePaymentStatus(label, PaymentStatusEnum.PAID, true);
      return true;
    }

    return false;
  }
}
