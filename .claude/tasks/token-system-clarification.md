# Token System Architecture - ВАЖНО ЗАПОМНИТЬ

## КРИТИЧЕСКАЯ ОШИБКА НАЙДЕНА

### Проблема
При смене токена старый токен продолжает работать, даже если его лимиты удалены из Redis. Причина: **API кеширует пользователя по UUID токена на 1 час!**

### Как работает API (kinopoiskdev)

1. **AuthMiddleware** получает API-key из заголовка `x-api-key`
2. Вызывает `authService.findUserByToken(token)`:
   - Конвертирует API-key в UUID: `ApiKey.toUUID(token)`
   - **ПРОВЕРЯЕТ КЕШ**: `userCacheService.getUser(tokenUuid)` с ключом `user:{UUID}`
   - Если в кеше есть - возвращает из кеша (ТУТ ПРОБЛЕМА!)
   - Если нет - ищет в БД и кеширует на 1 час
3. Проверяет лимиты через `checkAndDecreaseLimit(token)` - использует API-key напрямую

### Почему старый токен работает

1. Пользователь использует старый токен (API-key: `QMGNSKM-MS74Y2H-JN9N9V0-P8N8R96`)
2. API конвертирует в UUID и находит закешированного пользователя по ключу `user:{old-uuid}`
3. Кеш живет 1 час, поэтому даже после смены токена в БД, старый UUID все еще в кеше
4. API думает что пользователь валидный и проверяет лимиты
5. Лимиты уже перенесены на новый API-key, но если старый токен был использован хотя бы раз после переноса, API создает новые лимиты через `setLimit`

### Решение

При смене токена нужно очистить ДВА места в Redis:
1. Лимиты по API-key: `{API-KEY}` (уже делаем)
2. **КЕШ ПОЛЬЗОВАТЕЛЯ по UUID: `user:{UUID}`** (НЕ ДЕЛАЕМ!)

## Принципы работы с токенами

### 1. Форматы токенов
- **В базе данных (MongoDB)**: UUID формат (например: `9724a8de-0eaf-417e-bef2-c94b7f6251c3`)
- **Для пользователя**: API-key формат (например: `XSYM6E9-9P24KFC-JM6KG7Z-0G0B0W8`)
- **В Redis (лимиты)**: API-key формат без префиксов

### 2. Преобразования
- UUID → API-key: `ApiKey.toAPIKey(uuid)` - для отображения пользователю
- API-key → UUID: `ApiKey.toUUID(apiKey)` - для поиска в базе данных

### 3. Генерация токенов
- **ПРАВИЛЬНО**: `import { v4 as uuidv4 } from 'uuid'; const token = uuidv4();`
- **НЕПРАВИЛЬНО**: `ApiKey.create().uuid` - это костыль, не использовать!

### 4. Смена токена
При смене токена:
1. Генерируем новый UUID через `uuidv4()`
2. Сохраняем UUID в базу данных
3. Переносим лимиты в Redis от старого API-key к новому
4. Удаляем старый API-key из Redis
5. Показываем пользователю новый токен в API-key формате

### 5. ВАЖНЫЕ УРОКИ

#### НЕТ лишнему кешированию
- **Данные пользователя НЕ кешировать** - они есть в базе данных
- Кешировать только лимиты API в Redis
- Всегда спрашивать "ЗАЧЕМ?" перед добавлением кеша

#### НЕТ переусложнению
- Не нужен черный список токенов - старый токен просто удаляется из БД
- Не нужен кеш пользователя по токену - это дублирование данных
- Не нужно делать лишние запросы к БД после обновления

#### Правильная последовательность операций
1. Сначала проверяем что операция возможна
2. Выполняем основное действие (изменение в БД)
3. Синхронизируем вспомогательные системы (Redis)
4. При ошибке на шаге 3 - откатываем или логируем

## Примеры кода

### Создание пользователя
```typescript
async create(user: User): Promise<User> {
  const token = uuidv4(); // Генерируем UUID
  return this.userModel.create({ ...user, token });
}
```

### Смена токена
```typescript
async changeToken(userId: number): Promise<string | null> {
  const user = await this.findOneByUserId(userId);
  if (!user) return null;

  const newToken = uuidv4(); // Новый UUID

  await this.userModel.updateOne(
    { userId },
    { token: newToken }
  );

  return newToken; // Возвращаем UUID
}
```

### Отображение токена пользователю
```typescript
const apiKey = ApiKey.toAPIKey(newToken); // UUID → API-key
await ctx.replyWithHTML(scene.success(apiKey).text);
```

### Перенос лимитов при смене токена
```typescript
async transferTokenLimits(oldToken: string, newToken: string): Promise<void> {
  // oldToken и newToken - это UUID из БД
  const oldApiKey = ApiKey.toAPIKey(oldToken);
  const newApiKey = ApiKey.toAPIKey(newToken);

  // Переносим лимиты
  const remainingLimit = await this.redis.get(oldApiKey);
  if (remainingLimit) {
    await this.redis.set(newApiKey, remainingLimit);
  }

  // ВАЖНО: Удаляем ДВА ключа!
  await this.redis.del(oldApiKey); // Удаляем лимиты старого API-key
  await this.redis.del(`user:${oldToken}`); // Удаляем кеш пользователя по UUID!
}
```

## ГЛАВНОЕ ПРАВИЛО
**ВСЕГДА ОТВЕЧАТЬ НА ВОПРОС "ЗАЧЕМ?"**
- Зачем кешировать, если данные есть в БД?
- Зачем усложнять, если можно проще?
- Зачем дублировать данные?

Если не можешь ответить "ЗАЧЕМ" - значит это не нужно!