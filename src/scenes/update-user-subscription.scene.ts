import { Scene, Ctx, SceneEnter, Action } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { TariffService } from '../tariff/tariff.service';
import { Markup } from 'telegraf';

@Scene(CommandEnum.UPDATE_USER_SUBSCRIPTION)
@Injectable()
export class UpdateUserSubscriptionScene {
  private readonly logger = new Logger(UpdateUserSubscriptionScene.name);

  constructor(private readonly userService: UserService, private readonly tariffService: TariffService) {}

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

    const user = await this.userService.findUserByUsername(username);
    if (!user) {
      await ctx.replyWithHTML('❌ Пользователь не найден');
      await ctx.scene.enter(CommandEnum.LIST_USERS);
      return;
    }

    if (action === 'change_tariff') {
      await this.showTariffSelection(ctx, username, user);
    } else if (action === 'extend_subscription') {
      await this.showExtensionOptions(ctx, username, user);
    }
  }

  private async showTariffSelection(ctx: Context, username: string, user: any) {
    const tariffs = await this.tariffService.getAllTariffs();
    const buttons = tariffs.map((tariff) => [
      Markup.button.callback(
        `${tariff.name} (${tariff.requestsLimit > 99999999990 ? '∞' : tariff.requestsLimit} req/day, ${
          tariff.price === 0 ? 'Free' : tariff.price + '₽/мес'
        })`,
        `select_tariff_${tariff._id}`,
      ),
    ]);
    buttons.push([Markup.button.callback('❌ Отмена', `back_user_${username}`)]);

    await ctx.replyWithHTML(
      `💼 <b>Изменение тарифа для ${username}</b>\n\n` +
        `Текущий тариф: <b>${user.tariffId?.name || 'N/A'}</b>\n\n` +
        'Выберите новый тариф:',
      Markup.inlineKeyboard(buttons),
    );
  }

  private async showExtensionOptions(ctx: Context, username: string, user: any) {
    ctx.scene.session.state.currentTariffId = user.tariffId?._id?.toString();

    const buttons = [
      [Markup.button.callback('+ 1 месяц', 'extend_1')],
      [Markup.button.callback('+ 3 месяца', 'extend_3')],
      [Markup.button.callback('+ 6 месяцев', 'extend_6')],
      [Markup.button.callback('+ 12 месяцев (1 год)', 'extend_12')],
      [Markup.button.callback('∞ Сделать бессрочной', 'extend_0')],
      [Markup.button.callback('❌ Отмена', `back_user_${username}`)],
    ];

    let message = `📅 <b>Продление подписки для ${username}</b>\n\n`;
    message += `Текущий тариф: <b>${user.tariffId?.name || 'N/A'}</b>\n`;

    if (user.subscriptionEndDate) {
      const endDate = new Date(user.subscriptionEndDate);
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

    const tariff = await this.tariffService.getOneById(tariffId);

    const buttons = [
      [Markup.button.callback('1 месяц', 'new_tariff_months_1')],
      [Markup.button.callback('3 месяца', 'new_tariff_months_3')],
      [Markup.button.callback('6 месяцев', 'new_tariff_months_6')],
      [Markup.button.callback('12 месяцев (1 год)', 'new_tariff_months_12')],
      [Markup.button.callback('∞ Бессрочно', 'new_tariff_months_0')],
      [Markup.button.callback('❌ Отмена', `back_user_${username}`)],
    ];

    await ctx.editMessageText(`✅ Новый тариф: <b>${tariff.name}</b>\n\n` + 'Выберите срок подписки:', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons),
    });

    await ctx.answerCbQuery();
  }

  @Action(/^new_tariff_months_(\d+)$/)
  async onNewTariffMonths(@Ctx() ctx: Context) {
    const months = parseInt(ctx.match[1], 10);
    const { username, newTariffId } = ctx.scene.session.state;

    let subscriptionEndDate: Date | undefined;
    if (months > 0) {
      subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + months);
    }

    try {
      await this.userService.updateSubscription(username, newTariffId, subscriptionEndDate);

      const tariff = await this.tariffService.getOneById(newTariffId);

      let message = `✅ <b>Тариф успешно изменен!</b>\n\n`;
      message += `👤 Пользователь: ${username}\n`;
      message += `💼 Новый тариф: <b>${tariff.name}</b>\n`;

      if (subscriptionEndDate) {
        message += `📅 Подписка до: ${subscriptionEndDate.toLocaleDateString('ru-RU')} (${months} мес.)`;
      } else {
        message += `📅 Подписка: бессрочная`;
      }

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ К пользователю', `back_user_${username}`)]]),
      });

      await ctx.answerCbQuery('✅ Тариф изменен!');

      this.logger.log(`Changed tariff for user ${username} to ${tariff.name}, months: ${months}`);
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

    const user = await this.userService.findUserByUsername(username);

    let subscriptionEndDate: Date;

    if (months === 0) {
      // Бессрочная подписка
      subscriptionEndDate = undefined;
    } else {
      // Продление от текущей даты окончания или от сегодня
      if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()) {
        subscriptionEndDate = new Date(user.subscriptionEndDate);
      } else {
        subscriptionEndDate = new Date();
      }
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + months);
    }

    try {
      await this.userService.updateSubscription(username, currentTariffId, subscriptionEndDate);

      let message = `✅ <b>Подписка успешно продлена!</b>\n\n`;
      message += `👤 Пользователь: ${username}\n`;
      message += `💼 Тариф: <b>${user.tariffId?.name}</b>\n`;

      if (subscriptionEndDate) {
        message += `📅 Подписка до: ${subscriptionEndDate.toLocaleDateString('ru-RU')} (+${months} мес.)`;
      } else {
        message += `📅 Подписка: бессрочная`;
      }

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ К пользователю', `back_user_${username}`)]]),
      });

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
