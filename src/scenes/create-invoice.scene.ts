import { Scene, Ctx, On, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { PaymentService } from '../payment/payment.service';
import { Markup } from 'telegraf';

@Scene(CommandEnum.CREATE_INVOICE)
@Injectable()
export class CreateInvoiceScene {
  private readonly logger = new Logger(CreateInvoiceScene.name);

  constructor(private readonly paymentService: PaymentService) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: Context) {
    ctx.scene.session.state = {};

    await ctx.replyWithHTML(
      '🧾 <b>Создание счета</b>\n\n' + 'Шаг 1/3: Введите сумму в рублях\n\n' + '<i>Например: 1000</i>',
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
    if (text === '➕ Создать пользователя') {
      await ctx.scene.enter(CommandEnum.CREATE_USER);
      return;
    }
    if (text === '📋 Список пользователей') {
      await ctx.scene.enter(CommandEnum.LIST_USERS);
      return;
    }
    if (text === '⏰ Истекающие подписки') {
      await ctx.scene.enter(CommandEnum.EXPIRING_SUBSCRIPTIONS);
      return;
    }

    const state = ctx.scene.session.state;

    if (!state.amount) {
      const amount = Number(text.trim());

      if (isNaN(amount) || amount <= 0) {
        await ctx.replyWithHTML('❌ Введите корректную сумму (число больше 0)');
        return;
      }

      state.amount = amount;

      await ctx.replyWithHTML(
        `✅ Сумма: <b>${amount} ₽</b>\n\n` +
          'Шаг 2/3: Введите описание платежа\n\n' +
          '<i>Например: Оплата за консультацию</i>',
        Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', CommandEnum.ADMIN_MENU)]]),
      );
      return;
    }

    if (!state.description) {
      state.description = text.trim();

      await ctx.replyWithHTML(
        `✅ Сумма: <b>${state.amount} ₽</b>\n` +
          `✅ Описание: <b>${state.description}</b>\n\n` +
          'Шаг 3/3: Введите email для чека\n\n' +
          '<i>Например: user@example.com</i>',
        Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', CommandEnum.ADMIN_MENU)]]),
      );
      return;
    }

    if (!state.email) {
      const email = text.trim();

      if (!email.includes('@')) {
        await ctx.replyWithHTML('❌ Введите корректный email');
        return;
      }

      state.email = email;

      try {
        const { paymentUrl, orderId } = await this.paymentService.createInvoice(state.amount, state.description, email);

        await ctx.replyWithHTML(
          `✅ <b>Счет создан</b>\n\n` +
            `💰 Сумма: ${state.amount} ₽\n` +
            `📝 Описание: ${state.description}\n` +
            `📧 Email: ${email}\n` +
            `🔖 Order ID: ${orderId}\n\n` +
            `🔗 Ссылка на оплату:\n${paymentUrl}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('🧾 Создать еще', CommandEnum.CREATE_INVOICE)],
            [Markup.button.callback('⬅️ В админ меню', CommandEnum.ADMIN_MENU)],
          ]),
        );

        this.logger.log(
          `Invoice created: amount=${state.amount}, description="${state.description}", email=${email}, orderId=${orderId}`,
        );
      } catch (error) {
        this.logger.error(`Error creating invoice: ${error.message}`, error.stack);
        await ctx.replyWithHTML(
          `❌ Ошибка при создании счета: ${error.message}`,
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ В админ меню', CommandEnum.ADMIN_MENU)]]),
        );
      }
    }
  }
}
