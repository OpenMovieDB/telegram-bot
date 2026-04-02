import { Context as TelegrafContext } from 'telegraf';

const NEW_BOT_ID = 8252040138;
let botId: number | null = null;

export function rebrandBlocker() {
  const skipRebrand = process.env.SKIP_REBRAND_BLOCKER === 'true';

  return async (ctx: TelegrafContext, next: () => Promise<void>) => {
    if (skipRebrand) {
      return next();
    }

    // Получаем bot ID один раз
    if (botId === null) {
      const botInfo = await ctx.telegram.getMe();
      botId = botInfo.id;
    }

    // Если это новый бот - просто продолжаем
    if (botId === NEW_BOT_ID) {
      return next();
    }

    // Если это старый бот - показываем сообщение КАЖДЫЙ РАЗ и НЕ продолжаем
    if (ctx.from) {
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
    }

    // НЕ вызываем next() - блокируем дальнейшую обработку для старого бота
  };
}
