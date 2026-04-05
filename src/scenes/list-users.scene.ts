import { Scene, Ctx, SceneEnter, Action } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { Markup } from 'telegraf';

@Scene(CommandEnum.LIST_USERS)
@Injectable()
export class ListUsersScene {
  private readonly logger = new Logger(ListUsersScene.name);

  constructor(private readonly userService: UserService) {}

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
    const externalUsers = await this.userService.findAllUsers({ isExternalUser: true });
    const totalUsersCount = await this.userService.countAllUsers();
    const telegramUsersCount = totalUsersCount - externalUsers.length;

    const pageSize = 5;
    const totalPages = Math.ceil(externalUsers.length / pageSize);
    const start = page * pageSize;
    const end = start + pageSize;
    const usersOnPage = externalUsers.slice(start, end);

    let message = '📋 <b>Список пользователей</b>\n\n';

    message += `📊 <b>Статистика:</b>\n`;
    message += `├ Telegram пользователи: ${telegramUsersCount}\n`;
    message += `├ Внешние пользователи: ${externalUsers.length}\n`;
    message += `└ Всего: ${totalUsersCount}\n\n`;

    if (externalUsers.length > 0) {
      message += `👥 <b>Внешние пользователи (стр. ${page + 1}/${totalPages}):</b>\n\n`;

      const buttons = [];

      for (const user of usersOnPage) {
        const username = user.username || 'N/A';
        const tariff = user.tariffId?.name || 'N/A';

        let status = '';
        if (user.subscriptionEndDate) {
          const daysLeft = Math.ceil(
            (new Date(user.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
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
