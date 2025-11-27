# Payment Logic Audit

## Цель
Провести полный аудит логики оплаты в телеграм-боте NestJS для выявления потенциальных проблем, race conditions и inconsistencies.

## Задачи
1. Анализ структуры проекта и поиск файлов связанных с оплатой
2. Изучение схем данных (Payment, User, Tariff)
3. Анализ сцен связанных с оплатой
4. Изучение PaymentService и логики обработки платежей
5. Проверка логики начисления месяцев и смены тарифов
6. Поиск потенциальных проблем и race conditions
7. Составление отчета с рекомендациями

## Статус: Завершен

## Результаты аудита

Проведен полный анализ логики оплаты в телеграм-боте NestJS. Ниже представлены найденные проблемы и рекомендации по исправлению.

### Найденные критические проблемы

#### 1. КРИТИЧЕСКАЯ: Race Condition при создании платежей
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/scenes/payment.scene.ts` (строки 64-68, 77-81)
**Проблема**: Используется in-memory Set для debounce защиты, который не работает в многопроцессорном окружении и может быть сброшен при перезапуске.
```typescript
private processingPayments = new Set<number>(); // НЕ THREAD-SAFE!
```

#### 2. КРИТИЧЕСКАЯ: Отсутствие атомарности операций с базой данных
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.service.ts` (строки 235-291)
**Проблема**: При успешной оплате происходит несколько отдельных операций без транзакций:
- Обновление пользователя
- Сброс кэша Redis
- Обновление статуса платежа
- Установка флагов в Redis

#### 3. ВЫСОКАЯ: Неконсистентное обновление кэша Redis
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.service.ts` (строки 241-242)
**Проблема**: Удаление токена из Redis происходит до обновления пользователя в MongoDB, что может привести к inconsistency.

#### 4. ВЫСОКАЯ: Проблемы с расчетом скидок
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.service.ts` (строки 103-106)
**Проблемы**:
- Использование `Math.floor()` может привести к потере копеек
- Расчет дневной ставки как `price / 30` неточен (месяцы имеют разное количество дней)
- Возможен отрицательный finalPrice

#### 5. СРЕДНЯЯ: Некорректный fallback при ошибках Redis
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/scenes/payment.scene.ts` (строки 232-241)
**Проблема**: При ошибке Redis используются данные из существующего платежа, но нет проверки на соответствие данных текущему выбору пользователя.

#### 6. СРЕДНЯЯ: Отсутствие защиты от дублирования платежей
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.service.ts` (строки 52-56)
**Проблема**: Проверка pending платежей происходит только в начале создания, но между проверкой и созданием может пройти время.

#### 7. НИЗКАЯ: Неоптимальные запросы к MongoDB
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/user/user.service.ts` (строка 40)
**Проблема**: `lean()` возвращает plain objects, но везде используется как Mongoose документы.

### Проблемы с обработкой edge cases

#### 8. Некорректная обработка смены часовых поясов
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.service.ts` (строки 82-86)
**Проблема**: Проверка "день истечения" может не работать корректно в разных часовых поясах.

#### 9. Потеря точности при расчетах
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/scenes/select-months.scene.ts` (строки 101-102)
**Проблема**: Прямое умножение price * paymentMonths без учета скидок в интерфейсе.

### Потенциальные проблемы безопасности

#### 10. Недостаточная валидация входных данных
**Файлы**: Все сцены
**Проблема**: Отсутствует валидация tariffId и paymentMonths из Redis на корректность.

#### 11. Возможность bypass ограничений
**Файл**: `/mnt/d/kinopoisk/telegram-bot/src/payment/payment.service.ts`
**Проблема**: Пользователь может изменить данные в Redis между выбором тарифа и созданием платежа.

## Рекомендации по исправлению

### Критические исправления (немедленно)

1. **Заменить in-memory debounce на Redis-based лок**:
```typescript
// В PaymentScene
async acquirePaymentLock(userId: number): Promise<boolean> {
  const key = `payment_lock:${userId}`;
  const result = await this.redis.set(key, '1', 'PX', 30000, 'NX');
  return result === 'OK';
}
```

2. **Внедрить MongoDB транзакции**:
```typescript
// В PaymentService.validatePayment()
const session = await this.connection.startSession();
session.startTransaction();
try {
  await this.userService.update(user.userId, updateData, { session });
  await this.updatePaymentStatus(paymentId, PaymentStatusEnum.PAID, true, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

3. **Исправить расчет скидок**:
```typescript
// Более точный расчет дневной ставки
const daysInMonth = DateTime.fromJSDate(user.subscriptionEndDate).daysInMonth;
const dailyRate = currentTariff.price / daysInMonth;
const discount = Math.round(dailyRate * daysRemaining * 100) / 100; // Точность до копеек
const finalPrice = Math.max(100, originalPrice - discount); // Минимум 1 рубль
```

### Высокоприоритетные исправления

4. **Добавить уникальные индексы в MongoDB**:
```javascript
// Payment collection
db.payments.createIndex(
  { "userId": 1, "status": 1, "paymentAt": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "status": "PENDING",
      "paymentAt": { "$gte": new Date(Date.now() - 24*60*60*1000) }
    }
  }
);
```

5. **Валидация данных из Redis**:
```typescript
private async validatePaymentData(userId: number, tariffId: string, paymentMonths: number): Promise<boolean> {
  if (!tariffId || paymentMonths < 1 || paymentMonths > 60) return false;

  const tariff = await this.tariffService.getOneById(tariffId);
  return !!tariff && !tariff.isHidden;
}
```

6. **Atomic операции с Redis**:
```typescript
// Использовать Redis MULTI для атомарных операций
const multi = this.redis.multi();
multi.del(`user:token:${user.token}`);
multi.set(`payment_flags:${userId}`, JSON.stringify(flags), 'EX', 3600);
await multi.exec();
```

### Средние исправления

7. **Добавить retry механизм для критических операций**
8. **Логирование всех финансовых операций в отдельную таблицу аудита**
9. **Добавить мониторинг и алерты на failed платежи**
10. **Реализовать graceful degradation при недоступности Redis**

### Низкоприоритетные улучшения

11. **Оптимизация запросов к MongoDB (добавить индексы)**
12. **Рефакторинг дублирующегося кода в сценах**
13. **Добавление метрик и трейсинга**

## Заключение

Система оплаты в целом функциональна, но содержит критические проблемы с race conditions и целостностью данных. Первоочередные исправления должны быть направлены на:

1. Обеспечение атомарности критических операций
2. Защиту от race conditions
3. Корректный расчет финансовых операций
4. Валидацию всех пользовательских данных

Рекомендуется внедрять исправления поэтапно с тщательным тестированием на staging окружении.