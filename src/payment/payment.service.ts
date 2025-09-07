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
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { CacheResetService } from '../cache/cache-reset.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
    private readonly paymentStrategyFactory: PaymentStrategyFactory,
    private readonly yooMoney: YooMoneyClient,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private readonly redisService: RedisService,
    private readonly cacheResetService: CacheResetService,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

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

    const originalPrice = tariff.price * paymentMonths;
    let finalPrice = originalPrice;
    let discount = 0;

    // Check for active subscription and tariff change
    const hasActiveSubscription =
      user.subscriptionEndDate && DateTime.fromJSDate(user.subscriptionEndDate) > DateTime.now();

    if (hasActiveSubscription && user.tariffId) {
      // user.tariffId is populated as Tariff object
      const currentTariff = user.tariffId as any;
      const currentTariffId = currentTariff._id ? currentTariff._id.toString() : currentTariff.toString();

      if (currentTariffId !== tariffId) {
        // Check if user is trying to downgrade
        if (tariff.price < currentTariff.price) {
          // Check if subscription expires today (allow downgrade on expiration day)
          const now = DateTime.now();
          const endDate = DateTime.fromJSDate(user.subscriptionEndDate);
          const isExpirationDay = endDate.hasSame(now, 'day');

          if (!isExpirationDay) {
            // Prevent downgrade while subscription is active
            const daysRemaining = Math.ceil(endDate.diff(now, 'days').days);
            const endDateFormatted = endDate.toFormat('dd.MM.yyyy');

            throw new Error(
              `DOWNGRADE_NOT_ALLOWED:Вы не можете перейти на более дешевый тариф пока действует текущая подписка. ` +
                `Ваш тариф "${currentTariff.name}" действует еще ${daysRemaining} дней (до ${endDateFormatted}). ` +
                `Вы сможете сменить тариф на "${tariff.name}" в день истечения подписки или после.`,
            );
          }
          // If it's expiration day, allow the downgrade without discount
          discount = 0;
          this.logger.debug(`Allowing downgrade on expiration day from ${currentTariff.name} to ${tariff.name}`);
        } else {
          // Calculate discount for upgrade
          const daysRemaining = DateTime.fromJSDate(user.subscriptionEndDate).diff(DateTime.now(), 'days').days;
          const dailyRate = currentTariff.price / 30;
          discount = Math.floor(dailyRate * daysRemaining);
          finalPrice = Math.max(0, finalPrice - discount);

          this.logger.debug(
            `Applied discount of ${discount} RUB for tariff upgrade. Days remaining: ${daysRemaining}, Final price: ${finalPrice}`,
          );
        }
      }
    }

    const paymentStrategy = this.paymentStrategyFactory.createPaymentStrategy(paymentSystem);
    const payment = await paymentStrategy.createPayment({
      userId,
      chatId,
      tariffId,
      tariffPrice: finalPrice / paymentMonths, // Pass the adjusted price per month
      paymentMonths,
      email,
      paymentAt: paymentAt || DateTime.local().toJSDate(),
      limit: tariff.requestsLimit,
    });

    // Add discount information to payment
    payment.discount = discount;
    payment.originalPrice = originalPrice;

    return this.paymentModel.create(payment);
  }

  async getPendingPayments(): Promise<Payment[]> {
    // Get pending payments that are not older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.paymentModel
      .find({
        status: PaymentStatusEnum.PENDING,
        paymentAt: { $gte: oneDayAgo },
        isFinal: false,
      })
      .exec();
  }

  async getExpiredPendingPayments(): Promise<Payment[]> {
    // Get pending payments older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.paymentModel
      .find({
        status: PaymentStatusEnum.PENDING,
        paymentAt: { $lt: oneDayAgo },
        isFinal: false,
      })
      .exec();
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

    // Skip if payment is already finalized
    if (payment.isFinal) {
      this.logger.debug(`Payment ${paymentId} is already finalized with status ${payment.status}`);
      return payment.status === PaymentStatusEnum.PAID;
    }

    const paymentStrategy = this.paymentStrategyFactory.createPaymentStrategy(payment.paymentSystem);

    let paymentStatus: PaymentStatusEnum;
    let isFinal = false;

    try {
      paymentStatus = await paymentStrategy.validateTransaction(payment.paymentId);
    } catch (error) {
      this.logger.error(`Error during payment validation for ${paymentId}: ${error.message}`, error.stack);
      // On validation errors, keep payment as PENDING, not FAILED
      // This allows retry on the next scheduler run
      paymentStatus = PaymentStatusEnum.PENDING;
      // Don't mark as final so it can be retried
      isFinal = false;
    }

    const isPaid = paymentStatus === PaymentStatusEnum.PAID;

    // Determine if this status is final (only if no error occurred)
    if (!isFinal && paymentStatus !== PaymentStatusEnum.PENDING) {
      isFinal = [PaymentStatusEnum.PAID, PaymentStatusEnum.FAILED, PaymentStatusEnum.CANCELED].includes(paymentStatus);
    }

    this.logger.debug(
      `Payment ${paymentId} validation result: status=${paymentStatus}, isPaid=${isPaid}, isFinal=${isFinal}`,
    );

    if (isPaid) {
      const user = await this.userService.findOneByUserId(payment.userId);

      if (user) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const key = ApiKey.toAPIKey(user.token);
        await this.redis.del(key);

        const now = DateTime.now();
        // user.tariffId is populated as Tariff object
        const currentTariff = user.tariffId as any;
        const currentTariffId = currentTariff?._id ? currentTariff._id.toString() : currentTariff?.toString();
        const newTariffId = payment.tariffId;
        const hasActiveSubscription = user.subscriptionEndDate && DateTime.fromJSDate(user.subscriptionEndDate) > now;

        const updateData: any = {
          requestsUsed: 0,
        };

        if (hasActiveSubscription) {
          // User has an active subscription
          if (currentTariffId === newTariffId) {
            // Same tariff - extend subscription
            const currentEndDate = DateTime.fromJSDate(user.subscriptionEndDate);
            const newEndDate = currentEndDate.plus({ months: payment.monthCount }).endOf('day');

            updateData.subscriptionEndDate = newEndDate.toJSDate();
            this.logger.debug(`Extended subscription for user ${user.userId} until ${newEndDate.toISODate()}`);
          } else {
            // Different tariff - immediately change tariff and extend subscription
            const now = DateTime.now().startOf('day');
            const newEndDate = now.plus({ months: payment.monthCount }).endOf('day');

            updateData.tariffId = new mongoose.Types.ObjectId(newTariffId);
            updateData.subscriptionStartDate = now.toJSDate();
            updateData.subscriptionEndDate = newEndDate.toJSDate();

            this.logger.debug(
              `Changed tariff for user ${user.userId} to ${newTariffId} until ${newEndDate.toISODate()}`,
            );
          }
        } else {
          // No active subscription - activate immediately
          const startAt = DateTime.now().startOf('day');
          const expiredAt = startAt.plus({ months: payment.monthCount }).endOf('day');

          updateData.tariffId = new mongoose.Types.ObjectId(newTariffId);
          updateData.subscriptionStartDate = startAt.toJSDate();
          updateData.subscriptionEndDate = expiredAt.toJSDate();

          this.logger.debug(`Activated new subscription for user ${user.userId} until ${expiredAt.toISODate()}`);
        }

        await this.userService.update(user.userId, updateData);

        if (updateData.tariffId) {
          try {
            const newTariff = await this.tariffService.getOneById(newTariffId);
            if (newTariff && user.token) {
              await this.cacheResetService.resetUserCacheAndLimits(user.userId, user.token, newTariff.requestsLimit);
              this.logger.log(`Reset cache and limits for user ${user.userId}, new limit: ${newTariff.requestsLimit}`);
            }
          } catch (cacheError) {
            this.logger.error(`Failed to reset cache for user ${user.userId}:`, cacheError);
          }
        }
      }

      this.logger.debug(
        `Change status for ${paymentId} from ${payment.status} to ${PaymentStatusEnum.PAID}. IsPaid: ${isPaid}`,
      );
      await this.updatePaymentStatus(paymentId, PaymentStatusEnum.PAID, true);
    } else {
      if (paymentStatus !== payment.status) {
        this.logger.debug(
          `Change status for ${paymentId} from ${payment.status} to ${paymentStatus}, IsPaid: ${isPaid}, IsFinal: ${isFinal}`,
        );
        await this.updatePaymentStatus(paymentId, paymentStatus, isFinal);
      }
    }

    return isPaid;
  }

  async getPaymentForm(paymentId: string): Promise<string> {
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) throw new Error(`Payment with id ${paymentId} not found`);

    return payment.form;
  }

  async findPaymentByPaymentId(paymentId: string): Promise<Payment> {
    return this.paymentModel.findOne({ paymentId }).exec();
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
