import { Scene, Ctx, SceneEnter, Action } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { accountTariffName } from '../utils/tariff-display.util';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { AccountClient } from '../account/account.client';
import { Markup } from 'telegraf';

const PAGE_SIZE = 5;

@Scene(CommandEnum.LIST_USERS)
@Injectable()
export class ListUsersScene {
  private readonly logger = new Logger(ListUsersScene.name);

  constructor(private readonly accountClient: AccountClient) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: Context) {
    this.logger.log('Entering LIST_USERS scene');
    await this.showUsersList(ctx);
  }

  @Action(/^page_(\d+)$/)
  async onPageChange(@Ctx() ctx: Context) {
    const page = parseInt(ctx.match[1], 10);
    await this.showUsersList(ctx, page, true);
    await ctx.answerCbQuery();
  }

  private async showUsersList(ctx: Context, page = 0, isEdit = false) {
    const [{ items: usersOnPage, total: externalTotal }, { total: totalUsersCount }] = await Promise.all([
      this.accountClient.listAccounts({ external: true, page: page + 1, limit: PAGE_SIZE, withEntitlement: true }),
      this.accountClient.listAccounts({ page: 1, limit: 1 }),
    ]);
    const telegramUsersCount = totalUsersCount - externalTotal;
    const totalPages = Math.max(1, Math.ceil(externalTotal / PAGE_SIZE));

    let message = '📋 <b>Список пользователей</b>\n\n';

    message += `📊 <b>Статистика:</b>\n`;
    message += `├ Telegram пользователи: ${telegramUsersCount}\n`;
    message += `├ Внешние пользователи: ${externalTotal}\n`;
    message += `└ Всего: ${totalUsersCount}\n\n`;

    if (externalTotal > 0) {
      message += `👥 <b>Внешние пользователи (стр. ${page + 1}/${totalPages}):</b>\n\n`;

      const buttons = [];

      for (const user of usersOnPage) {
        const username = user.username || 'N/A';
        const tariff = accountTariffName(user.tariff);

        let status = '';
        if (user.subscription_end) {
          const daysLeft = Math.ceil(
            (new Date(user.subscription_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
          );
          status = daysLeft > 0 ? `${daysLeft} дн.` : 'истекла';
        } else {
          status = '∞';
        }

        message += `👤 ${username} | ${tariff} | ${status}\n`;
        buttons.push([Markup.button.callback(`👤 ${username}`, `user_${username}`)]);
      }

      // Пагинация
      const paginationButtons = [];
      if (page > 0) {
        paginationButtons.push(Markup.button.callback('⬅️ Назад', `page_${page - 1}`));
      }
      if (page < totalPages - 1) {
        paginationButtons.push(Markup.button.callback('Вперед ➡️', `page_${page + 1}`));
      }
      if (paginationButtons.length > 0) {
        buttons.push(paginationButtons);
      }

      buttons.push([Markup.button.callback('⬅️ В админ меню', CommandEnum.ADMIN_MENU)]);

      if (isEdit) {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(buttons),
        });
      } else {
        await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
      }
    } else {
      message += 'Внешних пользователей пока нет.';
      const buttons = [[Markup.button.callback('⬅️ В админ меню', CommandEnum.ADMIN_MENU)]];

      if (isEdit) {
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(buttons),
        });
      } else {
        await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
      }
    }
  }

  @Action(/^user_(.+)$/)
  async onUserSelect(@Ctx() ctx: Context) {
    const username = ctx.match[1];
    // Передаём username в оба места для надёжности
    ctx.scene.session.state = { username };
    await ctx.scene.enter(CommandEnum.USER_DETAILS, { username } as any);
    await ctx.answerCbQuery();
  }
}
