import { Scene, Ctx, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { Markup } from 'telegraf';
import { DateTime } from 'luxon';

@Scene(CommandEnum.EXPIRING_SUBSCRIPTIONS)
@Injectable()
export class ExpiringSubscriptionsScene {
  private readonly logger = new Logger(ExpiringSubscriptionsScene.name);

  constructor(private readonly userService: UserService) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: Context) {
    this.logger.log('Entering EXPIRING_SUBSCRIPTIONS scene');

    const expiringSoon3Days = await this.userService.getExpiringSubscriptions(3);
    const expiringSoon7Days = await this.userService.getExpiringSubscriptions(7);
    const expiringSoon30Days = await this.userService.getExpiringSubscriptions(30);

    let message = '⏰ <b>Истекающие подписки</b>\n\n';

    message += `📊 <b>Статистика:</b>\n`;
    message += `├ Истекают в течение 3 дней: ${expiringSoon3Days.length}\n`;
    message += `├ Истекают в течение 7 дней: ${expiringSoon7Days.length}\n`;
    message += `└ Истекают в течение 30 дней: ${expiringSoon30Days.length}\n\n`;

    if (expiringSoon3Days.length > 0) {
      message += '🔴 <b>Истекают в течение 3 дней:</b>\n\n';
      for (const user of expiringSoon3Days.slice(0, 10)) {
        const identifier = user.username || `TG:${user.userId}`;
        const endDate = DateTime.fromJSDate(new Date(user.subscriptionEndDate));
        const daysLeft = Math.ceil(endDate.diffNow('days').days);

        message += `👤 <code>${identifier}</code>\n`;
        message += `├ Тариф: ${user.tariffId?.name || 'N/A'}\n`;
        message += `└ Истекает: ${endDate.toFormat('dd.MM.yyyy')} (${daysLeft} дн.)\n\n`;
      }

      if (expiringSoon3Days.length > 10) {
        message += `... и еще ${expiringSoon3Days.length - 10} пользователей\n\n`;
      }
    }

    if (expiringSoon7Days.length > expiringSoon3Days.length) {
      message += `⚠️ <b>Истекают в течение 7 дней:</b> ${
        expiringSoon7Days.length - expiringSoon3Days.length
      } пользователей\n`;
    }

    if (expiringSoon30Days.length > expiringSoon7Days.length) {
      message += `⏰ <b>Истекают в течение 30 дней:</b> ${
        expiringSoon30Days.length - expiringSoon7Days.length
      } пользователей\n`;
    }

    await ctx.replyWithHTML(
      message,
      Markup.inlineKeyboard([[Markup.button.callback('⬅ в админ меню', CommandEnum.ADMIN_MENU)]]),
    );
  }
}
