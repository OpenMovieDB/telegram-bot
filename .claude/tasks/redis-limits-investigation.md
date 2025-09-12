# Задача: Исследование сброса лимитов пользователей в Redis

## Описание проблемы
У пользователя лимиты периодически сбрасываются с "использовано 11, осталось 2489" обратно на "использовано 0, осталось 2500".

## Цель
Найти все места в коде где могут сбрасываться или устанавливаться лимиты пользователей в Redis.

## Процесс выполнения
1. ✅ Поиск всех Redis операций связанных с лимитами пользователей
2. ✅ Поиск cron job'ов и scheduled задач влияющих на лимиты 
3. ✅ Поиск мест обновления тарифов пользователей
4. ✅ Поиск мест декремента лимитов запросов в API
5. 🔄 Анализ результатов и составление отчета

## Найденные результаты

### 1. Места установки лимитов в Redis (redis.set)

#### В telegram-bot:
- `/mnt/d/kinopoisk/telegram-bot/src/cache/cache-reset.service.ts:44` - `resetUserCacheAndLimits()` - Устанавливает новый лимит после смены тарифа
- `/mnt/d/kinopoisk/telegram-bot/src/cache/cache-reset.service.ts:130` - `setUserLimit()` - Устанавливает лимит для пользователя
- `/mnt/d/kinopoisk/telegram-bot/src/cache/cache-reset.service.ts:190` - `transferTokenLimits()` - Переносит лимит при смене токена

#### В kinopoiskdev API:
- `/mnt/d/kinopoisk/kinopoiskdev/src/auth/auth.service.ts:63` - `setLimit()` - Устанавливает лимит из тарифа пользователя

### 2. Места удаления лимитов в Redis (redis.del)

#### В telegram-bot:
- `/mnt/d/kinopoisk/telegram-bot/src/cache/cache-reset.service.ts:39` - Удаляет кэш пользователя
- `/mnt/d/kinopoisk/telegram-bot/src/cache/cache-reset.service.ts:74,79,114` - Удаляет поврежденные записи кэша
- `/mnt/d/kinopoisk/telegram-bot/src/cache/cache-reset.service.ts:188` - Удаляет старый apiKey при переносе лимитов
- `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.service.ts:202` - **КРИТИЧНО!** Удаляет лимиты при успешной оплате

#### В kinopoiskdev API:
- `/mnt/d/kinopoisk/kinopoiskdev/src/user/user.service.ts:29` - **КРИТИЧНО!** Ежедневный cron job удаляет ВСЕ лимиты пользователей
- `/mnt/d/kinopoisk/kinopoiskdev/src/auth/services/user-cache.service.ts:24,54` - Удаляет кэш пользователя

### 3. CRON Jobs влияющие на лимиты

#### ⚠️ ОСНОВНАЯ ПРОБЛЕМА:
- `/mnt/d/kinopoisk/kinopoiskdev/src/user/user.service.ts:21-32` - **Каждый день в полночь удаляет ВСЕ лимиты всех пользователей!**
```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async resetRequestsUsedAndCache() {
  this.logger.log('Start: Reset requests used & cache');
  const cursor = this.userRepository.find({}).cursor();
  for await (const user of cursor) {
    const key = ApiKey.toAPIKey(user.token);
    await this.redis.del(key); // ← ЗДЕСЬ УДАЛЯЮТСЯ ВСЕ ЛИМИТЫ!
  }
  this.logger.log('Finish: Reset requests used & cache');
}
```

#### Другие cron jobs:
- `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.scheduler.ts:24` - Каждые 10 секунд проверяет платежи
- `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.scheduler.ts:105` - Каждые 5 часов обрабатывает истекшие подписки
- `/mnt/d/kinopoisk/telegram-bot/src/bot.service.ts:159` - Каждый день в полночь проверяет пользователей

### 4. Места декремента лимитов (использование запросов)

#### В kinopoiskdev API:
- `/mnt/d/kinopoisk/kinopoiskdev/src/auth/auth.service.ts:52` - `checkAndDecreaseLimit()` декрементирует лимит при каждом API запросе
- `/mnt/d/kinopoisk/kinopoiskdev/src/auth/middleware/auth.middleware.ts:37` - Middleware вызывает проверку лимитов

### 5. Места обновления тарифов

#### В telegram-bot:
- `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.service.ts:249-261` - При успешной оплате обновляет тариф и сбрасывает лимиты
- `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.scheduler.ts:127-132` - При истечении подписки переводит на FREE тариф

## ВЫВОД О ПРИЧИНЕ ПРОБЛЕМЫ

**Главная причина сброса лимитов:** Ежедневный cron job в `/mnt/d/kinopoisk/kinopoiskdev/src/user/user.service.ts` каждую полночь удаляет ВСЕ лимиты всех пользователей из Redis. 

После удаления лимита, при следующем запросе к API:
1. `auth.service.ts:43` - Получает `null` из Redis 
2. `auth.service.ts:46` - Вызывает `setLimit()` 
3. `auth.service.ts:63` - Устанавливает полный лимит из тарифа пользователя

Это объясняет почему лимиты сбрасываются с "использовано 11, осталось 2489" на "использовано 0, осталось 2500" - происходит ежедневный сброс в полночь.

## Статус
✅ Завершено - найдена основная причина проблемы