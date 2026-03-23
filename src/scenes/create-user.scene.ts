import { Scene, Ctx, On, SceneEnter, Action } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { TariffService } from '../tariff/tariff.service';
import { Markup } from 'telegraf';
import * as ApiKey from 'uuid-apikey';

@Scene(CommandEnum.CREATE_USER)
@Injectable()
export class CreateUserScene {
  private readonly logger = new Logger(CreateUserScene.name);

  constructor(
    private readonly userService: UserService,
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
      const existingUser = await this.userService.findUserByUsername(username);
      if (existingUser) {
        await ctx.replyWithHTML(`❌ Пользователь с username "${username}" уже существует.`);
        return;
      }

      state.username = username;

      // Переходим к выбору тарифа
      const tariffs = await this.tariffService.getAllTariffs();
      const buttons = tariffs.map((tariff) => [
        Markup.button.callback(
          `${tariff.name} (${tariff.requestsLimit > 99999999990 ? '∞' : tariff.requestsLimit} req/day, ${tariff.price === 0 ? 'Free' : tariff.price + '₽/мес'})`,
          `tariff_${tariff._id}`,
        ),
      ]);
      buttons.push([Markup.button.callback('❌ Отмена', CommandEnum.ADMIN_MENU)]);

      await ctx.replyWithHTML(
        `✅ Username: <code>${username}</code>\n\n` +
          '📋 Шаг 2/3: Выберите тариф:',
        Markup.inlineKeyboard(buttons),
      );
    }
  }

  @Action(/^tariff_(.+)$/)
  async onTariffSelect(@Ctx() ctx: Context) {
    const tariffId = ctx.match[1];
    const state = ctx.scene.session.state;

    state.tariffId = tariffId;

    const tariff = await this.tariffService.getOneById(tariffId);

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
        `✅ Тариф: <b>${tariff.name}</b>\n\n` +
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

    let subscriptionEndDate: Date | undefined;
    if (months > 0) {
      subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + months);
    }

    try {
      const newUser = await this.userService.createExternalUser(
        state.username,
        state.tariffId,
        subscriptionEndDate,
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const apiKey = ApiKey.toAPIKey(newUser.token);

      const tariff = await this.tariffService.getOneById(state.tariffId);

      let message =
        '✅ <b>Пользователь успешно создан!</b>\n\n' +
        `👤 Username: <code>${newUser.username}</code>\n` +
        `🔑 API Token: <code>${apiKey}</code>\n` +
        `💼 Тариф: ${tariff.name}\n`;

      if (subscriptionEndDate) {
        message += `📅 Подписка до: ${subscriptionEndDate.toLocaleDateString('ru-RU')} (${months} мес.)`;
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

      this.logger.log(`Created external user: ${state.username}, tariff: ${tariff.name}, months: ${months}`);
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      await ctx.editMessageText(`❌ Ошибка при создании пользователя: ${error.message}`, {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ В админ меню', CommandEnum.ADMIN_MENU)]]),
      });
      await ctx.answerCbQuery('❌ Ошибка!');
    }
  }
}
