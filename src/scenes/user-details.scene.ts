import { Scene, Ctx, SceneEnter, Action } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CacheResetService } from '../cache/cache-reset.service';
import { Markup } from 'telegraf';
import * as ApiKey from 'uuid-apikey';

@Scene(CommandEnum.USER_DETAILS)
@Injectable()
export class UserDetailsScene {
  private readonly logger = new Logger(UserDetailsScene.name);

  constructor(private readonly userService: UserService, private readonly cacheResetService: CacheResetService) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: Context) {
    this.logger.log('Entering USER_DETAILS scene');
    // Получаем username либо из state, либо из параметров сцены
    const username = ctx.scene.session.state?.username || (ctx.scene.state as any)?.username;

    if (!username) {
      this.logger.error('Username not found!');
      await ctx.replyWithHTML('❌ Пользователь не выбран');
      await ctx.scene.enter(CommandEnum.ADMIN_MENU);
      return;
    }

    await this.showUserDetails(ctx, username);
  }

  private async showUserDetails(ctx: Context, username: string, isEdit = false) {
    const user = await this.userService.findUserByUsername(username);

    if (!user) {
      await ctx.replyWithHTML('❌ Пользователь не найден');
      await ctx.scene.enter(CommandEnum.LIST_USERS);
      return;
    }

    const totalLimit = user.tariffId?.requestsLimit || 0;
    const remaining = user.token ? await this.cacheResetService.getTokenLimit(user.token) : 0;
    const used = totalLimit > 0 ? Math.max(0, totalLimit - remaining) : 0;
    const limitDisplay = totalLimit > 99999999990 ? '∞' : totalLimit;

    let message = `👤 <b>Пользователь: ${user.username}</b>\n\n`;
    message += `💼 Тариф: <b>${user.tariffId?.name || 'N/A'}</b>\n`;
    message += `📊 Лимит запросов: ${limitDisplay} req/day\n`;
    message += `📈 Использовано: ${used} / ${limitDisplay} запросов\n\n`;

    if (user.subscriptionEndDate) {
      const endDate = new Date(user.subscriptionEndDate);
      const daysLeft = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

      message += `📅 Подписка до: ${endDate.toLocaleDateString('ru-RU')}\n`;
      message += `⏰ Осталось: ${daysLeft > 0 ? `${daysLeft} дн.` : 'истекла ❌'}\n`;
    } else {
      message += `📅 Подписка: бессрочная ∞\n`;
    }

    if (user.subscriptionStartDate) {
      message += `📅 Начало подписки: ${new Date(user.subscriptionStartDate).toLocaleDateString('ru-RU')}\n`;
    }

    const buttons = [
      [Markup.button.callback('🔑 Показать токен', `show_token_${username}`)],
      [Markup.button.callback('🔄 Сменить токен', `change_token_${username}`)],
      [Markup.button.callback('💼 Изменить тариф', `change_tariff_${username}`)],
      [Markup.button.callback('📅 Продлить подписку', `extend_subscription_${username}`)],
      [Markup.button.callback('⬅️ К списку', CommandEnum.LIST_USERS)],
      [Markup.button.callback('🏠 В админ меню', CommandEnum.ADMIN_MENU)],
    ];

    if (isEdit) {
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });
    } else {
      await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
    }
  }

  @Action(/^show_token_(.+)$/)
  async onShowToken(@Ctx() ctx: Context) {
    const username = ctx.match[1];
    const user = await this.userService.findUserByUsername(username);

    if (!user) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const apiKey = ApiKey.toAPIKey(user.token);

    await ctx.answerCbQuery('🔑 Токен отправлен в сообщении', { show_alert: false });
    await ctx.replyWithHTML(
      `🔑 <b>API Token для ${username}:</b>\n\n<code>${apiKey}</code>\n\n<i>Скопируйте токен и передайте пользователю</i>`,
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', `back_to_user_${username}`)]]),
    );
  }

  @Action(/^change_token_(.+)$/)
  async onChangeToken(@Ctx() ctx: Context) {
    const username = ctx.match[1];
    const user = await this.userService.findUserByUsername(username);

    if (!user) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    const newToken = await this.userService.changeToken(user.userId);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const apiKey = ApiKey.toAPIKey(newToken);

    await ctx.answerCbQuery('✅ Токен изменен!', { show_alert: true });
    await ctx.editMessageText(
      `✅ <b>Токен успешно изменен для ${username}!</b>\n\n` +
        `🔑 Новый токен:\n<code>${apiKey}</code>\n\n` +
        `<i>⚠️ Старый токен больше не действителен</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', `back_to_user_${username}`)]]),
      },
    );

    this.logger.log(`Changed token for user: ${username}`);
  }

  @Action(/^change_tariff_(.+)$/)
  async onChangeTariff(@Ctx() ctx: Context) {
    const username = ctx.match[1];
    const stateData = { username, action: 'change_tariff' };
    ctx.scene.session.state = stateData;
    await ctx.scene.enter(CommandEnum.UPDATE_USER_SUBSCRIPTION, stateData as any);
    await ctx.answerCbQuery();
  }

  @Action(/^extend_subscription_(.+)$/)
  async onExtendSubscription(@Ctx() ctx: Context) {
    const username = ctx.match[1];
    const stateData = { username, action: 'extend_subscription' };
    ctx.scene.session.state = stateData;
    await ctx.scene.enter(CommandEnum.UPDATE_USER_SUBSCRIPTION, stateData as any);
    await ctx.answerCbQuery();
  }

  @Action(/^back_to_user_(.+)$/)
  async onBackToUser(@Ctx() ctx: Context) {
    const username = ctx.match[1];
    await this.showUserDetails(ctx, username, true);
    await ctx.answerCbQuery();
  }
}
