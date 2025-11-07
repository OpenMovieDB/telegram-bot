import { Update, Ctx, On } from 'nestjs-telegraf';
import { Context } from '../interfaces/context.interface';

@Update()
export class RebrandUpdate {
  private notifiedUsers = new Set<number>();

  @On('message')
  async onAnyMessage(@Ctx() ctx: Context) {
    // Отправляем уведомление только один раз каждому пользователю
    if (ctx.from && !this.notifiedUsers.has(ctx.from.id)) {
      await ctx.reply(
        '⚠️ <b>Важное уведомление о ребрендинге</b>\n\n' +
          'В рамках ребрендинга и отказа от ассоциаций с компанией которую нельзя называть сменились домены и бот.\n\n' +
          '🌐 <b>Новые адреса:</b>\n' +
          '• Сайт: https://poiskkino.dev\n' +
          '• API: https://api.poiskkino.dev\n' +
          '• Бот: @poiskkinodev_bot\n\n' +
          'Пожалуйста, перейдите на нового бота для продолжения работы.',
        { parse_mode: 'HTML' },
      );
      this.notifiedUsers.add(ctx.from.id);
    }
  }
}
