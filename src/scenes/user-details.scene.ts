import { Scene, Ctx, SceneEnter, Action } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { accountTariffName } from '../utils/tariff-display.util';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { AccountClient } from '../account/account.client';
import { Markup } from 'telegraf';

@Scene(CommandEnum.USER_DETAILS)
@Injectable()
export class UserDetailsScene {
  private readonly logger = new Logger(UserDetailsScene.name);

  constructor(private readonly accountClient: AccountClient) {}

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
    const account = await this.accountClient.getByUsername(username);

    if (!account) {
      await ctx.replyWithHTML('❌ Пользователь не найден');
      await ctx.scene.enter(CommandEnum.LIST_USERS);
      return;
    }

    const usage = await this.accountClient.getUsage(account.id);
    const totalLimit = usage.limit;
    const used = usage.used;
    const limitDisplay = totalLimit > 99999999990 ? '∞' : totalLimit;

    let message = `👤 <b>Пользователь: ${account.username}</b>\n\n`;
    message += `💼 Тариф: <b>${accountTariffName(account.tariff)}</b>\n`;
    message += `📊 Лимит запросов: ${limitDisplay} req/day\n`;
    message += `📈 Использовано: ${used} / ${limitDisplay} запросов\n\n`;

    if (account.subscription_end) {
      const endDate = new Date(account.subscription_end);
      const daysLeft = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

      message += `📅 Подписка до: ${endDate.toLocaleDateString('ru-RU')}\n`;
      message += `⏰ Осталось: ${daysLeft > 0 ? `${daysLeft} дн.` : 'истекла ❌'}\n`;
    } else {
      message += `📅 Подписка: бессрочная ∞\n`;
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
    const account = await this.accountClient.getByUsername(username);

    if (!account) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    if (!account.api_key) {
      await ctx.answerCbQuery('❌ Не удалось получить токен');
      return;
    }

    await ctx.answerCbQuery('🔑 Токен отправлен в сообщении', { show_alert: false });
    await ctx.replyWithHTML(
      `🔑 <b>API Token для ${username}:</b>\n\n<code>${account.api_key}</code>\n\n<i>Скопируйте токен и передайте пользователю</i>`,
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', `back_to_user_${username}`)]]),
    );
  }

  @Action(/^change_token_(.+)$/)
  async onChangeToken(@Ctx() ctx: Context) {
    const username = ctx.match[1];
    const account = await this.accountClient.getByUsername(username);

    if (!account) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    let newApiKey: string | null = null;
    try {
      const rotated = await this.accountClient.rotateToken(account.id);
      newApiKey = rotated.api_key;
    } catch (error) {
      this.logger.error(`Failed to rotate token for ${username} (${account.id}):`, error);
    }

    if (!newApiKey) {
      await ctx.answerCbQuery('❌ Не удалось сменить токен', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('✅ Токен изменен!', { show_alert: true });
    await ctx.editMessageText(
      `✅ <b>Токен успешно изменен для ${username}!</b>\n\n` +
        `🔑 Новый токен:\n<code>${newApiKey}</code>\n\n` +
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
