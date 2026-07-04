import { Scene, Ctx, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { AccountClient } from '../account/account.client';
import { BillingClient, BillingExpiringSubscription } from '../billing/billing.client';
import { TariffService } from '../tariff/tariff.service';
import { Markup } from 'telegraf';
import { DateTime } from 'luxon';

@Scene(CommandEnum.EXPIRING_SUBSCRIPTIONS)
@Injectable()
export class ExpiringSubscriptionsScene {
  private readonly logger = new Logger(ExpiringSubscriptionsScene.name);

  constructor(
    private readonly billingClient: BillingClient,
    private readonly accountClient: AccountClient,
    private readonly tariffService: TariffService,
  ) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: Context) {
    this.logger.log('Entering EXPIRING_SUBSCRIPTIONS scene');

    // billing владеет подписками — одна выборка на максимальное окно,
    // остальные окна считаются по days_left.
    const expiring30Days = await this.billingClient.expiringSubscriptions(30);
    const expiring3Days = expiring30Days.filter((sub) => sub.days_left <= 3);
    const expiring7Days = expiring30Days.filter((sub) => sub.days_left <= 7);

    let message = '⏰ <b>Истекающие подписки</b>\n\n';

    message += `📊 <b>Статистика:</b>\n`;
    message += `├ Истекают в течение 3 дней: ${expiring3Days.length}\n`;
    message += `├ Истекают в течение 7 дней: ${expiring7Days.length}\n`;
    message += `└ Истекают в течение 30 дней: ${expiring30Days.length}\n\n`;

    if (expiring3Days.length > 0) {
      message += '🔴 <b>Истекают в течение 3 дней:</b>\n\n';
      for (const sub of expiring3Days.slice(0, 10)) {
        message += await this.describe(sub);
      }

      if (expiring3Days.length > 10) {
        message += `... и еще ${expiring3Days.length - 10} пользователей\n\n`;
      }
    }

    if (expiring7Days.length > expiring3Days.length) {
      message += `⚠️ <b>Истекают в течение 7 дней:</b> ${expiring7Days.length - expiring3Days.length} пользователей\n`;
    }

    if (expiring30Days.length > expiring7Days.length) {
      message += `⏰ <b>Истекают в течение 30 дней:</b> ${
        expiring30Days.length - expiring7Days.length
      } пользователей\n`;
    }

    await ctx.replyWithHTML(
      message,
      Markup.inlineKeyboard([[Markup.button.callback('⬅ в админ меню', CommandEnum.ADMIN_MENU)]]),
    );
  }

  private async describe(sub: BillingExpiringSubscription): Promise<string> {
    let identifier = sub.user_id;
    try {
      const account = await this.accountClient.getById(sub.user_id);
      identifier =
        account.username ||
        account.telegram_username ||
        (account.telegram_id ? `TG:${account.telegram_id}` : sub.user_id);
    } catch (error) {
      this.logger.warn(`Failed to resolve account ${sub.user_id}: ${(error as Error).message}`);
    }
    const tariff = await this.tariffService.getOneById(sub.tariff_id);
    const endDate = DateTime.fromISO(sub.expires_at);

    let line = `👤 <code>${identifier}</code>\n`;
    line += `├ Тариф: ${tariff?.display_name || 'N/A'}\n`;
    line += `└ Истекает: ${endDate.toFormat('dd.MM.yyyy')} (${sub.days_left} дн.)\n\n`;
    return line;
  }
}
