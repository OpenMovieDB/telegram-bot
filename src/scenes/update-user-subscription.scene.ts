import { Scene, Ctx, SceneEnter, Action } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { AccountClient } from '../account/account.client';
import { AccountResponseDto } from '../account/dto/account-response.dto';
import { BillingClient } from '../billing/billing.client';
import { TariffService } from '../tariff/tariff.service';
import { accountTariffName, adminTariffButtonLabel } from '../utils/tariff-display.util';
import { Markup } from 'telegraf';

@Scene(CommandEnum.UPDATE_USER_SUBSCRIPTION)
@Injectable()
export class UpdateUserSubscriptionScene {
  private readonly logger = new Logger(UpdateUserSubscriptionScene.name);

  constructor(
    private readonly accountClient: AccountClient,
    private readonly billingClient: BillingClient,
    private readonly tariffService: TariffService,
  ) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: Context) {
    this.logger.log('Entering UPDATE_USER_SUBSCRIPTION scene');
    // Получаем данные либо из session.state, либо из scene.state
    const sessionData = ctx.scene.session.state || {};
    const sceneData = (ctx.scene.state as any) || {};
    const username = sessionData.username || sceneData.username;
    const action = sessionData.action || sceneData.action;

    if (!username || !action) {
      await ctx.replyWithHTML('❌ Ошибка: данные не переданы');
      await ctx.scene.enter(CommandEnum.ADMIN_MENU);
      return;
    }

    const account = await this.accountClient.getByUsername(username);
    if (!account) {
      await ctx.replyWithHTML('❌ Пользователь не найден');
      await ctx.scene.enter(CommandEnum.LIST_USERS);
      return;
    }

    if (action === 'change_tariff') {
      await this.showTariffSelection(ctx, username, account);
    } else if (action === 'extend_subscription') {
      await this.showExtensionOptions(ctx, username, account);
    }
  }

  private async showTariffSelection(ctx: Context, username: string, account: AccountResponseDto) {
    // Admin picks from the full catalog, hidden (partner/staff) tariffs included.
    const tariffs = await this.tariffService.getAdminTariffs();
    const buttons = tariffs.map((tariff) => [
      Markup.button.callback(adminTariffButtonLabel(tariff), `select_tariff_${tariff.id}`),
    ]);
    buttons.push([Markup.button.callback('❌ Отмена', `back_user_${username}`)]);

    await ctx.replyWithHTML(
      `💼 <b>Изменение тарифа для ${username}</b>\n\n` +
        `Текущий тариф: <b>${accountTariffName(account.tariff)}</b>\n\n` +
        'Выберите новый тариф:',
      Markup.inlineKeyboard(buttons),
    );
  }

  private async showExtensionOptions(ctx: Context, username: string, account: AccountResponseDto) {
    ctx.scene.session.state.currentTariffId = account.tariff?.id;

    const buttons = [
      [Markup.button.callback('+ 1 месяц', 'extend_1')],
      [Markup.button.callback('+ 3 месяца', 'extend_3')],
      [Markup.button.callback('+ 6 месяцев', 'extend_6')],
      [Markup.button.callback('+ 12 месяцев (1 год)', 'extend_12')],
      [Markup.button.callback('∞ Сделать бессрочной', 'extend_0')],
      [Markup.button.callback('❌ Отмена', `back_user_${username}`)],
    ];

    let message = `📅 <b>Продление подписки для ${username}</b>\n\n`;
    message += `Текущий тариф: <b>${accountTariffName(account.tariff)}</b>\n`;

    if (account.subscription_end) {
      const endDate = new Date(account.subscription_end);
      const daysLeft = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      message += `Подписка до: ${endDate.toLocaleDateString('ru-RU')} (${
        daysLeft > 0 ? `${daysLeft} дн.` : 'истекла'
      })\n\n`;
    } else {
      message += `Подписка: бессрочная\n\n`;
    }

    message += 'Выберите период продления:';

    await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
  }

  @Action(/^select_tariff_(.+)$/)
  async onTariffSelect(@Ctx() ctx: Context) {
    const tariffId = ctx.match[1];
    const { username } = ctx.scene.session.state;

    ctx.scene.session.state.newTariffId = tariffId;

    const tariff = await this.tariffService.resolveForAdmin(tariffId);

    const buttons = [
      [Markup.button.callback('1 месяц', 'new_tariff_months_1')],
      [Markup.button.callback('3 месяца', 'new_tariff_months_3')],
      [Markup.button.callback('6 месяцев', 'new_tariff_months_6')],
      [Markup.button.callback('12 месяцев (1 год)', 'new_tariff_months_12')],
      [Markup.button.callback('∞ Бессрочно', 'new_tariff_months_0')],
      [Markup.button.callback('❌ Отмена', `back_user_${username}`)],
    ];

    await ctx.editMessageText(`✅ Новый тариф: <b>${tariff?.display_name ?? '—'}</b>\n\n` + 'Выберите срок подписки:', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons),
    });

    await ctx.answerCbQuery();
  }

  // Единый путь записи: billing владеет подпиской и сам проставляет тариф в
  // account. Никаких локальных записей у бота нет.
  private async grant(ctx: Context, username: string, tariffId: string, months: number, successTitle: string) {
    const account = await this.accountClient.getByUsername(username);
    if (!account) {
      await ctx.replyWithHTML('❌ Пользователь не найден');
      return;
    }

    const grant = await this.billingClient.adminGrantSubscription({
      user_id: account.id,
      tariff_id: tariffId,
      ...(months > 0 ? { months } : { perpetual: true }),
    });

    const tariff = await this.tariffService.resolveForAdmin(tariffId);

    let message = `✅ <b>${successTitle}</b>\n\n`;
    message += `👤 Пользователь: ${username}\n`;
    message += `💼 Тариф: <b>${tariff?.display_name ?? '—'}</b>\n`;

    if (grant.expires_at) {
      message += `📅 Подписка до: ${new Date(grant.expires_at).toLocaleDateString('ru-RU')} (${months} мес.)`;
    } else {
      message += `📅 Подписка: бессрочная`;
    }

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ К пользователю', `back_user_${username}`)]]),
    });
  }

  @Action(/^new_tariff_months_(\d+)$/)
  async onNewTariffMonths(@Ctx() ctx: Context) {
    const months = parseInt(ctx.match[1], 10);
    const { username, newTariffId } = ctx.scene.session.state;

    try {
      await this.grant(ctx, username, newTariffId, months, 'Тариф успешно изменен!');
      await ctx.answerCbQuery('✅ Тариф изменен!');
      this.logger.log(`Changed tariff for user ${username} to ${newTariffId}, months: ${months}`);
    } catch (error) {
      this.logger.error(`Failed to change tariff: ${error.message}`, error.stack);
      await ctx.editMessageText(`❌ Ошибка при изменении тарифа: ${error.message}`, {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ К пользователю', `back_user_${username}`)]]),
      });
      await ctx.answerCbQuery('❌ Ошибка!');
    }
  }

  @Action(/^extend_(\d+)$/)
  async onExtend(@Ctx() ctx: Context) {
    const months = parseInt(ctx.match[1], 10);
    const { username, currentTariffId } = ctx.scene.session.state;

    try {
      await this.grant(ctx, username, currentTariffId, months, 'Подписка успешно продлена!');
      await ctx.answerCbQuery('✅ Подписка продлена!');
      this.logger.log(`Extended subscription for user ${username} by ${months} months`);
    } catch (error) {
      this.logger.error(`Failed to extend subscription: ${error.message}`, error.stack);
      await ctx.editMessageText(`❌ Ошибка при продлении подписки: ${error.message}`, {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ К пользователю', `back_user_${username}`)]]),
      });
      await ctx.answerCbQuery('❌ Ошибка!');
    }
  }

  @Action(/^back_user_(.+)$/)
  async onBackToUser(@Ctx() ctx: Context) {
    const username = ctx.match[1];
    ctx.scene.session.state = { username };
    await ctx.scene.enter(CommandEnum.USER_DETAILS);
    await ctx.answerCbQuery();
  }
}
