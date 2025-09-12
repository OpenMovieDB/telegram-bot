# Антиспам система для Telegram бота

## Анализ текущей архитектуры

### Текущая структура бота:
- **NestJS + Telegraf**: Основа на NestJS с использованием Telegraf для работы с Telegram API
- **Scene-based архитектура**: Разговоры организованы через сцены (`src/scenes/`)
- **MongoDB**: Основная база данных с моделью User
- **Redis**: Кэширование пользователей и лимитов запросов
- **Обработчики событий**: `BotUpdate` обрабатывает команды, действия и сообщения

### Существующие обработчики сообщений в `BotUpdate`:
- `@Hears(/.*/)`: Обрабатывает все текстовые сообщения только в private чатах
- `@On('new_chat_members')`: Отслеживает новых участников
- `@On('left_chat_member')`: Отслеживает покидание чата
- **Ограничение**: Сейчас бот работает только с private сообщениями (`!['private'].includes(message.chat.type)`)

### Модель пользователя в MongoDB:
```typescript
{
  userId: number (unique),
  chatId?: number,
  token: string (unique),
  username: string,
  tariffId: ObjectId,
  inChat: boolean,
  // ... другие поля
}
```

### Кэш Redis:
- Кэш пользователей по токену: `user:${uuid}`
- Лимиты по API ключам: `${apiKey}` -> количество запросов
- Методы в `CacheResetService` для работы с кэшом по userId

## План архитектуры антиспам системы

### 1. Создание сервиса модерации
**Файл**: `src/moderation/moderation.service.ts`

```typescript
@Injectable()
export class ModerationService {
  // Проверка пользователя в Redis кэше
  async checkUserInCache(userId: number): Promise<boolean>
  
  // Проверка пользователя в базе данных
  async checkUserInDatabase(userId: number): Promise<User | null>
  
  // Кэширование результата проверки
  async cacheUserCheck(userId: number, exists: boolean): Promise<void>
  
  // Удаление сообщения и бан пользователя
  async moderateMessage(ctx: Context, user: any): Promise<void>
  
  // Отправка уведомления админу с кнопкой разбана
  async sendAdminNotification(userId: number, username: string, messageText: string): Promise<void>
  
  // Разбан пользователя (добавление в базу)
  async unbanUser(userId: number, username: string): Promise<User>
}
```

### 2. Модификация BotUpdate для мониторинга всех сообщений
**Изменения в** `src/bot.update.ts`:

```typescript
// Новый обработчик для всех сообщений в группах и тредах
@On('text')
async onText(@Ctx() ctx: Context & { update: any }) {
  const message = ctx.update.message;
  
  // Проверяем только сообщения в целевом чате (1665946947)
  if (message.chat.id !== parseInt(this.configService.get('CHAT_ID'))) {
    return;
  }
  
  // Пропускаем private чаты (они обрабатываются отдельно)
  if (message.chat.type === 'private') {
    return;
  }
  
  // Запускаем проверку пользователя
  await this.moderationService.checkAndModerateUser(ctx);
}

// Обработчик для сообщений в тредах
@On('message')
async onMessage(@Ctx() ctx: Context & { update: any }) {
  // Аналогичная логика для всех типов сообщений
}
```

### 3. Создание inline клавиатуры для админа
**Файл**: `src/moderation/moderation.keyboards.ts`

```typescript
export const createUnbanKeyboard = (userId: number, username: string) => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '✅ Разбанить пользователя', callback_data: `unban_${userId}` }],
      [{ text: '❌ Оставить в бане', callback_data: `ignore_${userId}` }]
    ]
  }
});
```

### 4. Redis кэш структура для антиспама
```
spam:user:{userId} -> "exists" | "not_exists" (TTL: 1 час)
spam:checked:{userId} -> timestamp последней проверки (TTL: 10 минут)
```

### 5. Обработчик callback'ов для разбана
```typescript
@Action(/^unban_(\d+)$/)
async onUnbanUser(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
  const userId = parseInt(ctx.match[1]);
  await this.moderationService.unbanUser(userId, 'username_from_message');
  // Обновляем сообщение админа
  await ctx.editMessageText('✅ Пользователь разбанен и добавлен в базу');
}
```

### 6. Новый модуль ModerationModule
**Файл**: `src/moderation/moderation.module.ts`

```typescript
@Module({
  imports: [UserModule, RedisModule],
  providers: [ModerationService],
  exports: [ModerationService]
})
export class ModerationModule {}
```

## Последовательность работы системы

1. **Получение сообщения** в чате 1665946947 (в любом треде)
2. **Быстрая проверка в Redis кэше** по ключу `spam:user:{userId}`
3. **Если в кэше нет** → проверка в MongoDB через `UserService.findOneByUserId()`
4. **Если пользователя нет в базе**:
   - Удалить сообщение через `ctx.deleteMessage()`
   - Забанить пользователя через `ctx.banChatMember()`
   - Кэшировать результат в Redis
   - Отправить уведомление админу с кнопкой разбана
5. **Если пользователь есть** → кэшировать положительный результат
6. **По кнопке разбана** → создать пользователя через `UserService.create()`

## Конфигурация

Добавить в `.env`:
```
CHAT_ID=1665946947           # ID основного чата для мониторинга
ADMIN_CHAT_ID=...            # Уже существует
SPAM_CACHE_TTL=3600          # TTL кэша проверки пользователей (1 час)
SPAM_CHECK_COOLDOWN=600      # Кулдаун между проверками (10 минут)
```

## Оптимизации производительности

1. **Кэш на уровне приложения**: Map для часто проверяемых пользователей
2. **Батч проверки**: Группировка проверок пользователей
3. **Дебаунсинг**: Избежание множественных проверок одного пользователя
4. **Lazy loading**: Проверка только при активности пользователя

Эта архитектура обеспечивает:
- ✅ Мониторинг всех сообщений в чате и тредах  
- ✅ Быстрые проверки через Redis кэш
- ✅ Автоматическое удаление сообщений спамеров
- ✅ Уведомления админа с возможностью разбана
- ✅ Интеграция с существующей системой регистрации
- ✅ Масштабируемость и производительность