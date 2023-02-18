import { Context, Telegraf } from 'telegraf';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Payment, PaymentDocument } from './schemas/payment.schema';

import { BotService } from 'src/bot.service';
import { PaymentService } from './payment.service';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';
import { DateTime } from 'luxon';

@Injectable()
export class PaymentScheduler {
  private readonly logger = new Logger(PaymentScheduler.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
    private readonly botService: BotService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handlePendingPayments() {
    const pendingPayments = await this.paymentService.getPendingPayments();

    if (pendingPayments.length) {
      this.logger.debug('Start validating pending payments');
      for (const payment of pendingPayments) {
        try {
          const isPaid = await this.paymentService.validatePayment(payment.paymentId);

          if (isPaid) {
            const user = await this.userService.findOneByUserId(payment.userId);

            this.logger.debug(`Payment with id ${payment.paymentId} is paid`);
            await this.botService.sendPaymentSuccessMessage(
              payment.chatId,
              user.tariffId.name,
              user.subscriptionEndDate,
            );
          }
        } catch (error) {
          this.logger.error(`Error validating payment with id ${payment.paymentId}: ${error.message}`);
        }
      }

      this.logger.debug('Finish validating pending payments');
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleExpiredSubscription() {
    const now = DateTime.local();
    const expirationDate = now.plus({ days: 2 });

    const tariffs = await this.tariffService.getAllTariffs();
    const freeTariff = tariffs.find((tariff) => tariff.name === 'FREE')._id;
    const paidTariffs = tariffs.filter((tariff) => tariff.name !== 'FREE').map((tariff) => tariff._id.toString());

    const usersWithExpiredSubscription = await this.userService.getUsersWithExpiredSubscription(
      now.toJSDate(),
      paidTariffs,
    );

    if (usersWithExpiredSubscription.length) {
      this.logger.debug('Start handling expired subscriptions');

      for (const user of usersWithExpiredSubscription) {
        try {
          await this.userService.update(user.userId, {
            tariffId: freeTariff,
            subscriptionStartDate: null,
            subscriptionEndDate: null,
            sendWarnNotification: false,
          });

          this.logger.debug(`User ${user.userId} tariff has been changed to free`);
          await this.botService.sendSubscriptionExpiredMessage(user.chatId);
        } catch (error) {
          this.logger.error(`Error handling expired subscription for user ${user.userId}: ${error.message}`);
        }
      }

      this.logger.debug('Finish handling expired subscriptions');
    }

    const usersWithExpiringSubscription = await this.userService.getUsersWithExpiredSubscription(
      expirationDate.toJSDate(),
      paidTariffs,
    );

    if (usersWithExpiringSubscription.length) {
      this.logger.debug('Start handling expiring subscriptions');

      for (const user of usersWithExpiringSubscription) {
        try {
          await this.botService.sendSubscriptionExpirationWarningMessage(user.chatId, user.subscriptionEndDate);
          await this.userService.update(user.userId, { sendWarnNotification: true });
        } catch (error) {
          this.logger.error(`Error handling expiring subscription for user ${user.userId}: ${error.message}`);
        }
      }

      this.logger.debug('Finish handling expiring subscriptions');
    }
  }
}
