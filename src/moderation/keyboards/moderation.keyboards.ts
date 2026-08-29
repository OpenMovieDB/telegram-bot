export const createReviewKeyboard = (userId: number, messageId: number) => ({
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: '🚫 Заблокировать и удалить сообщения',
          callback_data: `modban_${userId}_${messageId}`,
        },
      ],
      [
        {
          text: '✅ Не блокировать',
          callback_data: `modkeep_${userId}`,
        },
      ],
    ],
  },
});

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
