export const createUnbanKeyboard = (userId: number, username: string) => ({
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '✅ Разбанить пользователя',
          callback_data: `unban_${userId}`,
        },
      ],
      [
        {
          text: '❌ Оставить в бане',
          callback_data: `ignore_${userId}`,
        },
      ],
    ],
  },
});

export const createUnbanConfirmationKeyboard = (userId: number) => ({
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '🔄 Очистить кэш пользователя',
          callback_data: `clear_cache_${userId}`,
        },
      ],
    ],
  },
});
