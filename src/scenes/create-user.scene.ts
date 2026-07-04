import { Scene, Ctx, On, SceneEnter, Action } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { AccountApiError, AccountClient } from '../account/account.client';
import { BillingClient } from '../billing/billing.client';
import { TariffService } from '../tariff/tariff.service';
import { adminTariffButtonLabel } from '../utils/tariff-display.util';
import { Markup } from 'telegraf';

@Scene(CommandEnum.CREATE_USER)
@Injectable()
export class CreateUserScene {
  private readonly logger = new Logger(CreateUserScene.name);

  constructor(
    private readonly accountClient: AccountClient,
    private readonly billingClient: BillingClient,
    private readonly tariffService: TariffService,
  ) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: Context) {
    this.logger.log('Entering CREATE_USER scene');

    // Очищаем состояние сцены
    ctx.scene.session.state = {};

    await ctx.replyWithHTML(
      '📝 <b>Создание нового пользователя</b>\n\n' +
        'Шаг 1/3: Введите username для нового пользователя\n\n' +
        '<i>Например: john_doe</i>',
      Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', CommandEnum.ADMIN_MENU)]]),
    );
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    const text = ctx.message?.['text'];
    if (!text) return;

    // Handle keyboard navigation buttons
    if (text === '📱в меню') {
      await ctx.scene.enter(CommandEnum.HOME);
      return;
    }
    if (text === '⏰ Истекающие подписки') {
      await ctx.scene.enter(CommandEnum.EXPIRING_SUBSCRIPTIONS);
      return;
    }
    if (text === '📋 Список пользователей') {
      await ctx.scene.enter(CommandEnum.LIST_USERS);
      return;
    }
    if (text === '🧾 Создать счет') {
      await ctx.scene.enter(CommandEnum.CREATE_INVOICE);
      return;
    }

    const state = ctx.scene.session.state;

    // Шаг 1: Получение username
    if (!state.username) {
      const username = text.trim();

      // Проверка на валидность username
      if (username.length < 3) {
        await ctx.replyWithHTML('❌ Username должен быть минимум 3 символа');
        return;
      }

      // Проверка на существование
      const existingUser = await this.accountClient.getByUsername(username);
      if (existingUser) {
        await ctx.replyWithHTML(`❌ Пользователь с username "${username}" уже существует.`);
        return;
      }

      state.username = username;

      // Переходим к выбору тарифа
      // Admin picks from the full catalog, hidden (partner/staff) tariffs included.
      const tariffs = await this.tariffService.getAdminTariffs();
      const buttons = tariffs.map((tariff) => [
        Markup.button.callback(adminTariffButtonLabel(tariff), `tariff_${tariff.id}`),
      ]);
      buttons.push([Markup.button.callback('❌ Отмена', CommandEnum.ADMIN_MENU)]);

      await ctx.replyWithHTML(
        `✅ Username: <code>${username}</code>\n\n` + '📋 Шаг 2/3: Выберите тариф:',
        Markup.inlineKeyboard(buttons),
      );
    }
  }

  @Action(/^tariff_(.+)$/)
  async onTariffSelect(@Ctx() ctx: Context) {
    const tariffId = ctx.match[1];
    const state = ctx.scene.session.state;

    state.tariffId = tariffId;

    const tariff = await this.tariffService.resolveForAdmin(tariffId);

    const buttons = [
      [Markup.button.callback('1 месяц', 'months_1')],
      [Markup.button.callback('3 месяца', 'months_3')],
      [Markup.button.callback('6 месяцев', 'months_6')],
      [Markup.button.callback('12 месяцев (1 год)', 'months_12')],
      [Markup.button.callback('∞ Бессрочно', 'months_0')],
      [Markup.button.callback('❌ Отмена', CommandEnum.ADMIN_MENU)],
    ];

    await ctx.editMessageText(
      `✅ Username: <code>${state.username}</code>\n` +
        `✅ Тариф: <b>${tariff?.display_name ?? '—'}</b>\n\n` +
        '📅 Шаг 3/3: Выберите срок подписки:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      },
    );

    await ctx.answerCbQuery();
  }

  @Action(/^months_(\d+)$/)
  async onMonthsSelect(@Ctx() ctx: Context) {
    const months = parseInt(ctx.match[1], 10);
    const state = ctx.scene.session.state;

    try {
      // account владеет токеном и identity внешнего клиента; billing — его подпиской.
      const account = await this.accountClient.createExternal(state.username);
      const grant = await this.billingClient.adminGrantSubscription({
        user_id: account.id,
        tariff_id: state.tariffId,
        ...(months > 0 ? { months } : { perpetual: true }),
      });

      const tariff = await this.tariffService.resolveForAdmin(state.tariffId);

      let message =
        '✅ <b>Пользователь успешно создан!</b>\n\n' +
        `👤 Username: <code>${account.username}</code>\n` +
        `🔑 API Token: <code>${account.api_key}</code>\n` +
        `💼 Тариф: ${tariff?.display_name ?? '—'}\n`;

      if (grant.expires_at) {
        message += `📅 Подписка до: ${new Date(grant.expires_at).toLocaleDateString('ru-RU')} (${months} мес.)`;
      } else {
        message += `📅 Подписка: бессрочная`;
      }

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Создать еще', CommandEnum.CREATE_USER)],
          [Markup.button.callback('⬅️ В админ меню', CommandEnum.ADMIN_MENU)],
        ]),
      });

      await ctx.answerCbQuery('✅ Пользователь создан!');

      this.logger.log(`Created external user: ${state.username}, tariff: ${state.tariffId}, months: ${months}`);
    } catch (error) {
      const reason =
        error instanceof AccountApiError && error.code === 'username_taken'
          ? `Username "${state.username}" уже занят`
          : error.message;
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      await ctx.editMessageText(`❌ Ошибка при создании пользователя: ${reason}`, {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ В админ меню', CommandEnum.ADMIN_MENU)]]),
      });
      await ctx.answerCbQuery('❌ Ошибка!');
    }
  }
}
