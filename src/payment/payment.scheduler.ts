import { Context, Telegraf } from 'telegraf';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Payment, PaymentDocument } from './schemas/payment.schema';

import { BOT_NAME } from 'src/constants/bot-name.const';
import { BotService } from 'src/bot.service';
import { InjectBot } from 'nestjs-telegraf';
import { PaymentService } from './payment.service';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class PaymentScheduler {
  private readonly logger = new Logger(PaymentScheduler.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,

    private readonly botService: BotService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handlePendingPayments() {
    this.logger.debug('Start validating pending payments');

    const pendingPayments = await this.paymentService.getPendingPayments();

    for (const payment of pendingPayments) {
      try {
        const isPaid = await this.paymentService.validatePayment(payment.paymentId);

        if (isPaid) {
          const user = await this.userService.findOneByUserId(payment.userId);

          this.logger.debug(`Payment with id ${payment.paymentId} is paid`);
          await this.botService.sendPaymentSuccessMessage(payment.chatId, user.tariffId.name, user.subscriptionEndDate);
        }
      } catch (error) {
        this.logger.error(`Error validating payment with id ${payment.paymentId}: ${error.message}`);
      }
    }

    this.logger.debug('Finish validating pending payments');
  }
}
