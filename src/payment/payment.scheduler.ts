import { Context, Telegraf } from 'telegraf';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Payment, PaymentDocument } from './schemas/payment.schema';

import { BotService } from 'src/bot.service';
import { PaymentService } from './payment.service';
import { PaymentStatusEnum } from './enum/payment-status.enum';
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
      this.logger.debug(`Start validating ${pendingPayments.length} pending payments`);
      for (const payment of pendingPayments) {
        try {
          this.logger.debug(`Validating payment ${payment.paymentId} (${payment.paymentSystem})`);
          const isPaid = await this.paymentService.validatePayment(payment.paymentId);

          if (isPaid) {
            const user = await this.userService.findOneByUserId(payment.userId);

            this.logger.debug(`Payment ${payment.paymentId} is successfully paid`);

            // Send success messages
            await this.botService.sendPaymentSuccessMessage(
              payment.chatId,
              user.tariffId.name,
              user.subscriptionEndDate,
            );

            await this.botService.sendPaymentSuccessMessageToAdmin(
              user.username,
              user.tariffId.name,
              payment.monthCount,
              payment.amount,
              payment.paymentSystem,
              payment.discount,
              payment.originalPrice,
            );
          } else {
            this.logger.debug(`Payment ${payment.paymentId} is not paid yet`);
          }
        } catch (error) {
          this.logger.error(`Error validating payment ${payment.paymentId}: ${error.message}`, error.stack);
          
          // Check if payment was marked as FAILED (timeout or other validation errors)
          const updatedPayment = await this.paymentService.findPaymentByPaymentId(payment.paymentId);
          if (updatedPayment && updatedPayment.status === PaymentStatusEnum.FAILED && updatedPayment.isFinal) {
            // Get user info for admin notification
            const user = await this.userService.findOneByUserId(payment.userId);
            
            // Notify user about the error
            try {
              await this.botService.sendMessage(
                payment.chatId,
                '❌ Произошла ошибка при обработке вашего платежа.\n\n' +
                '⚠️ Пожалуйста, свяжитесь с администратором для решения проблемы.\n\n' +
                '📧 Администратор: @mdwit\n' +
                `🔖 ID платежа: ${payment.paymentId}`
              );
            } catch (notifyError) {
              this.logger.error(`Failed to notify user about payment error: ${notifyError.message}`);
            }
            
            // Notify admin about the error
            try {
              await this.botService.sendPaymentErrorToAdmin(
                user?.username || 'Unknown',
                payment.userId,
                payment.paymentId,
                payment.paymentSystem,
                payment.amount,
                error.message,
                error.stack
              );
            } catch (adminError) {
              this.logger.error(`Failed to notify admin about payment error: ${adminError.message}`);
            }
          }
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

          // Notify user that payment expired
          try {
            await this.botService.sendMessage(
              payment.chatId,
              '⏰ Время оплаты истекло. Платеж был отменен. Если вы хотите оформить подписку, пожалуйста, создайте новый платеж.',
            );
          } catch (notifyError) {
            this.logger.error(`Failed to notify user about expired payment: ${notifyError.message}`);
          }
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

          // Check if chatId exists before sending message
          if (user.chatId) {
            await this.botService.sendSubscriptionExpiredMessage(user.chatId);
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
            // Check if chatId exists before sending message
            if (user.chatId) {
              await this.botService.sendSubscriptionExpirationWarningMessage(user.chatId, user.subscriptionEndDate);
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
}
