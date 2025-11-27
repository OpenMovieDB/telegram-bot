import { Context, Telegraf } from 'telegraf';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Payment, PaymentDocument } from './schemas/payment.schema';

import { BotService } from 'src/bot.service';
import { PaymentService } from './payment.service';
import { PaymentStatusEnum } from './enum/payment-status.enum';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';
import { SessionStateService } from 'src/session/session-state.service';
import { DateTime } from 'luxon';

@Injectable()
export class PaymentScheduler {
  private readonly logger = new Logger(PaymentScheduler.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
    private readonly botService: BotService,
    private readonly sessionStateService: SessionStateService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handlePendingPayments() {
    const pendingPayments = await this.paymentService.getPendingPayments();

    if (pendingPayments.length) {
      this.logger.debug(`Start validating ${pendingPayments.length} pending payments`);
      for (const payment of pendingPayments) {
        try {
          this.logger.debug(`Validating payment ${payment.paymentId} (${payment.paymentSystem})`);
          const isPaid = await this.paymentService.validatePayment(payment.paymentId);

          if (isPaid) {
            const user = await this.userService.findOneByUserId(payment.userId);

            this.logger.debug(`Payment ${payment.paymentId} is successfully paid`);

            // Clear payment flags in Redis so user can exit payment scene
            await this.sessionStateService.setExitPaymentScene(payment.userId);
            this.logger.debug(`Set exit payment scene flag for user ${payment.userId}`);

            // Send success messages asynchronously (DO NOT await - payment processing must not depend on message delivery)
            this.sendPaymentNotificationsAsync(payment, user).catch((error) => {
              this.logger.error(`Failed to send payment notifications for ${payment.paymentId}: ${error.message}`);
            });
          } else {
            this.logger.debug(`Payment ${payment.paymentId} is not paid yet`);
          }
        } catch (error) {
          this.logger.error(`Error validating payment ${payment.paymentId}: ${error.message}`, error.stack);
          // Errors are now handled in PaymentService - payments stay as PENDING on temporary errors
          // No need to send notifications here as payment will be retried
        }
      }

      this.logger.debug('Finish validating pending payments');
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredPayments() {
    const expiredPayments = await this.paymentService.getExpiredPendingPayments();

    if (expiredPayments.length) {
      this.logger.debug(`Start handling ${expiredPayments.length} expired payments`);
      for (const payment of expiredPayments) {
        try {
          const paymentAge = Date.now() - new Date(payment.paymentAt).getTime();
          const ageInHours = Math.floor(paymentAge / 3600000);
          this.logger.debug(`Marking payment ${payment.paymentId} as EXPIRED (age: ${ageInHours} hours)`);

          await this.paymentService.updatePaymentStatus(
            payment.paymentId,
            PaymentStatusEnum.FAILED,
            true, // Mark as final
          );

          // Notify user that payment expired asynchronously
          this.botService
            .sendMessage(
              payment.chatId,
              '⏰ Время оплаты истекло. Платеж был отменен. Если вы хотите оформить подписку, пожалуйста, создайте новый платеж.',
            )
            .catch((notifyError) => {
              this.logger.error(`Failed to notify user about expired payment: ${notifyError.message}`);
            });
        } catch (error) {
          this.logger.error(`Error handling expired payment ${payment.paymentId}: ${error.message}`);
        }
      }
      this.logger.debug('Finish handling expired payments');
    }
  }

  @Cron(CronExpression.EVERY_5_HOURS)
  async handleExpiredSubscription() {
    const now = DateTime.local();
    const expirationDate = now.plus({ days: 2 });

    this.logger.debug(`Start handling expired subscription. Expiration date: ${expirationDate.toISODate()}`);

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
          // Switch to free tariff for expired subscription
          await this.userService.update(user.userId, {
            tariffId: freeTariff,
            subscriptionStartDate: null,
            subscriptionEndDate: null,
            sendWarnNotification: false,
          });

          this.logger.debug(`User ${user.userId} (chatId: ${user.chatId}) tariff has been changed to free`);

          // Check if chatId exists before sending message asynchronously
          if (user.chatId) {
            this.botService.sendSubscriptionExpiredMessage(user.chatId).catch((error) => {
              this.logger.error(`Failed to send subscription expired message to ${user.chatId}: ${error.message}`);
            });
          } else {
            this.logger.warn(`User ${user.userId} has no chatId, skipping notification`);
          }
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
        if (!user.sendWarnNotification) {
          try {
            // Check if chatId exists before sending message asynchronously
            if (user.chatId) {
              this.botService
                .sendSubscriptionExpirationWarningMessage(user.chatId, user.subscriptionEndDate)
                .catch((error) => {
                  this.logger.error(`Failed to send subscription warning to ${user.chatId}: ${error.message}`);
                });
              await this.userService.update(user.userId, { sendWarnNotification: true });
            } else {
              this.logger.warn(`User ${user.userId} has no chatId, skipping expiration warning`);
            }
          } catch (error) {
            this.logger.error(`Error handling expiring subscription for user ${user.userId}: ${error.message}`);
          }
        }
      }

      this.logger.debug('Finish handling expiring subscriptions');
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAdminSubscriptionNotifications() {
    this.logger.debug('Start checking subscriptions for admin notifications');

    const now = DateTime.local();
    const tariffs = await this.tariffService.getAllTariffs();
    const paidTariffs = tariffs.filter((tariff) => tariff.name !== 'FREE').map((tariff) => tariff._id.toString());

    const expiringToday = await this.userService.getExpiringSubscriptions(0);
    const expiring3Days = await this.userService.getExpiringSubscriptions(3);
    const expiring30Days = await this.userService.getExpiringSubscriptions(30);

    const notifiedUsers = new Set<string>();

    for (const user of expiringToday) {
      if (paidTariffs.includes(user.tariffId?._id?.toString())) {
        const username = user.username || `TG:${user.userId}`;
        const key = `${username}_0`;
        if (!notifiedUsers.has(key)) {
          notifiedUsers.add(key);
          this.botService
            .sendAdminSubscriptionExpirationWarning(username, user.subscriptionEndDate, user.tariffId.name, 0)
            .catch((error) => {
              this.logger.error(`Failed to send admin notification for ${username}: ${error.message}`);
            });
        }
      }
    }

    for (const user of expiring3Days) {
      if (paidTariffs.includes(user.tariffId?._id?.toString())) {
        const username = user.username || `TG:${user.userId}`;
        const daysLeft = Math.ceil(
          DateTime.fromJSDate(user.subscriptionEndDate).diff(now, 'days').days,
        );

        const key = `${username}_3`;
        if (daysLeft > 0 && daysLeft <= 3 && !notifiedUsers.has(key)) {
          notifiedUsers.add(key);
          this.botService
            .sendAdminSubscriptionExpirationWarning(username, user.subscriptionEndDate, user.tariffId.name, daysLeft)
            .catch((error) => {
              this.logger.error(`Failed to send admin notification for ${username}: ${error.message}`);
            });
        }
      }
    }

    for (const user of expiring30Days) {
      if (paidTariffs.includes(user.tariffId?._id?.toString()) && user.subscriptionStartDate) {
        const subscriptionDuration = DateTime.fromJSDate(user.subscriptionEndDate).diff(
          DateTime.fromJSDate(user.subscriptionStartDate),
          'days',
        ).days;

        const isYearlySubscription = subscriptionDuration >= 330;

        if (isYearlySubscription) {
          const username = user.username || `TG:${user.userId}`;
          const daysLeft = Math.ceil(
            DateTime.fromJSDate(user.subscriptionEndDate).diff(now, 'days').days,
          );

          const key = `${username}_30`;
          if (daysLeft > 3 && daysLeft <= 30 && !notifiedUsers.has(key)) {
            notifiedUsers.add(key);
            this.botService
              .sendAdminSubscriptionExpirationWarning(username, user.subscriptionEndDate, user.tariffId.name, daysLeft)
              .catch((error) => {
                this.logger.error(`Failed to send admin notification for ${username}: ${error.message}`);
              });
          }
        }
      }
    }

    this.logger.debug(`Sent ${notifiedUsers.size} admin notifications for expiring subscriptions`);
  }

  private async sendPaymentNotificationsAsync(payment: any, user: any): Promise<void> {
    try {
      // Send user notification
      await this.botService.sendPaymentSuccessMessage(payment.chatId, user.tariffId.name, user.subscriptionEndDate);

      // Send admin notification
      await this.botService.sendPaymentSuccessMessageToAdmin(
        user.username,
        user.tariffId.name,
        payment.monthCount,
        payment.amount,
        payment.paymentSystem,
        payment.discount,
        payment.originalPrice,
      );
    } catch (error) {
      this.logger.error(`Error sending payment notifications for ${payment.paymentId}: ${error.message}`, error.stack);
      // Don't rethrow - notifications failure should not affect payment processing
    }
  }
}
