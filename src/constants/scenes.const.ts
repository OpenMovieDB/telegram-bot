import { BUTTONS, ADMIN_KEYBOARD_BUTTONS } from './buttons.const';
import { CommandEnum } from '../enum/command.enum';
import { BillingTariff } from 'src/billing/billing.client';
import { tariffLine, tariffButtons } from 'src/utils/tariff-display.util';
import { DateTime } from 'luxon';

export const SCENES = {
  [CommandEnum.START]: {
    text: (tariffs: BillingTariff[]) =>
      'Привет! Вижу, ты новенький.\n\nЯ выдаю токен к API poiskkino.dev, показываю статистику запросов и меняю тариф.\n\nНаши условия:\n\n' +
      tariffs.map(tariffLine).join('\n'),
    buttons: (tariffs: BillingTariff[]) => [...tariffButtons(tariffs), [BUTTONS[CommandEnum.DOCUMENTATION]]],
  },
  [CommandEnum.HOME]: {
    navigateText: 'Выбери действие:',
    navigateButtons: [
      [
        BUTTONS[CommandEnum.GET_REQUEST_STATS],
        // BUTTONS[CommandEnum.UPDATE_MOVIE],
        // BUTTONS[CommandEnum.SET_IMDB_RELATION],
      ],
      [BUTTONS[CommandEnum.GET_MY_TOKEN], BUTTONS[CommandEnum.QUESTION]],
      [BUTTONS[CommandEnum.UPDATE_TARIFF]],
    ],
  },
  [CommandEnum.GET_ACCESS]: {
    navigateText: 'Для получения доступа к API тебе нужно выбрать тарифный план по количеству запросов в сутки.',
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
    text: (tariffs: BillingTariff[]) => 'Тарифы: \n\n' + tariffs.map(tariffLine).join(''),
    buttons: tariffButtons,
  },
  [CommandEnum.UPDATE_TARIFF]: {
    text: (tariffs: BillingTariff[], currentTariff: string, subscriptionEndDate?: Date) =>
      `Ваш текущий тариф: <b>${currentTariff}</b>. \nДействует до: ${
        subscriptionEndDate ? DateTime.fromJSDate(subscriptionEndDate).toFormat('dd MMMM yyyy', { locale: 'ru' }) : '∞'
      }\n\n` +
      'Доступные тарифы: \n' +
      tariffs.map(tariffLine).join(''),
    buttons: tariffButtons,
  },
  [CommandEnum.PAYMENT]: {
    text: `Выберите способ оплаты:`,
    buttons: [[BUTTONS[CommandEnum.PAY_WITH_TBANK], BUTTONS[CommandEnum.PAY_WITH_CRYPTOMUS]]],
  },
  [CommandEnum.ISSUE_TOKEN]: {
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
    text: (token: string) =>
      `Твой токен для работы с API: \n\n<code>${token}</code>\n\nДокументация по API: <code>https://poiskkino.dev/documentation</code>\nОна описана в формате OpenAPI и поможет тебе быстро составить запрос к API.\n\nЕсли тебе снова нужна будет документация, в основном меню будет кнопка "🆘 поддержка".`,
  },
  [CommandEnum.QUESTION]: {
    text: `Если у тебя есть вопрос, то ты можешь, посмотреть в документацию или задать его в нашем чате.`,
    buttons: [BUTTONS[CommandEnum.JOIN_CHAT], BUTTONS[CommandEnum.DOCUMENTATION]],
  },
  [CommandEnum.GET_REQUEST_STATS]: {
    success: (requests: number, leftRequests: number) => ({
      text: `Вот статистика по использованию API:\n\n<b>Использовано:</b> <i>${requests}</i>\n<b>Осталось запросов:</b> <i>${
        leftRequests > 99999999990 ? '∞' : leftRequests
      }</i>`,
    }),
    error: () => ({
      text: `Вы еще не зарегистрированы в системе, для этого вам нужно получить токен.`,
    }),
  },
  [CommandEnum.I_HAVE_TOKEN]: {
    text: `Давай проверим его! И если все ок, привяжем его к твоему аккаунту! \n\n Введи токен:`,
    actions: {
      [CommandEnum.BIND_TOKEN]: {
        success: {
          text: `О, спасибо, я запомню, что он твой! \n\n Теперь ты можешь получить статистику по использованию API!`,
        },
        error: {
          text: `Этот токен не твой или его не существует!`,
        },
      },
    },
  },
  [CommandEnum.GET_MY_TOKEN]: {
    success: (token: string) => ({
      text: `Вот твой токен: \n\n<code>${token}</code>`,
      buttons: [BUTTONS[CommandEnum.CHANGE_TOKEN], BUTTONS[CommandEnum.HOME]],
    }),
    error: () => ({
      text: `У тебя еще нет токена. \n\n Чтобы получить токен, нажми на кнопку ниже.`,
      buttons: [BUTTONS[CommandEnum.GET_ACCESS]],
    }),
  },
  [CommandEnum.CHANGE_TOKEN]: {
    success: (newToken: string) => ({
      text: `✅ Токен успешно изменен!\n\n🔑 Новый токен: \n<code>${newToken}</code>`,
    }),
    error: () => ({
      text: `❌ Ошибка при смене токена. Попробуйте позже или обратитесь в поддержку.`,
    }),
  },
  [CommandEnum.UPDATE_MOVIE]: {
    text: `Я могу обновить или добавить фильмы. Пожалуйста, пришли мне список ID из поисккино разделенные запятой. \n\n Например: 666, 326, 435. \n\n Учитывай пожалуйста, что на обновление фильмов может потребоваться некоторое время. А так же, учитывай, что кеш действует сутки. Чтобы посмотреть результат без кеша, добавь в запрос параметр v= и любым значением.`,
    buttons: [BUTTONS[CommandEnum.BACK]],
    success: {
      text: `Выполнено! Этот список фильмов добавлен в приоритетную очередь на обновение`,
    },
    error: {
      text: `И как это обновлять? Кажется, ты не указал список ID 😨`,
      buttons: [BUTTONS[CommandEnum.BACK]],
    },
  },
  [CommandEnum.SET_IMDB_RELATION]: {
    text: `Я могу указать imdb id для фильма у которого его еще нет. Пришли мне список связей(id_poiskkino:id_imdb) разделенные запятой. \n\n Например: 666:tt0232500, 326:tt0111161, 435:tt0120689. \n\n <b>Пожалуйста, используйте этот функционал с пониманием ответственности!</b>`,
    buttons: [BUTTONS[CommandEnum.BACK]],
    success: {
      text: `Выполнено!`,
    },
    error: {
      text: `Это что за связи такие? Кажется, что-то напутал 🤨`,
      buttons: [BUTTONS[CommandEnum.BACK]],
    },
  },
  [CommandEnum.ADMIN_MENU]: {
    navigateText: '⚙️ <b>Админ панель</b>\n\nВыберите действие:',
    navigateButtons: [
      [ADMIN_KEYBOARD_BUTTONS.CREATE_USER, ADMIN_KEYBOARD_BUTTONS.CREATE_INVOICE],
      [ADMIN_KEYBOARD_BUTTONS.LIST_USERS, ADMIN_KEYBOARD_BUTTONS.EXPIRING_SUBSCRIPTIONS],
      [ADMIN_KEYBOARD_BUTTONS.HOME],
    ],
  },
  ERROR: () => ({
    navigateText: 'Что-то пошло не так 😔 Попробуйте ещё раз через пару секунд или нажмите «Домой».',
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
  }),
};

// The free key's steps and notices: the community chat and the developer channel.
export const MEMBERSHIP = {
  chatStep: '<b>Шаг 1 из 2.</b> Вступи в чат сообщества @omdb_dev — там задают вопросы по API и находят ответы.',
  channelStep: '<b>Шаг 2 из 2.</b> Подпишись на канал разработчика @mdwit0r.',
  notInChat: 'Тебя пока нет в чате @omdb_dev. Вступи и нажми «проверить».',
  notInChannel: 'Подписки на @mdwit0r пока нет. Подпишись и нажми «проверить».',
  token: (apiKey: string, condition?: { tariffName: string; requestsLimit: number }) =>
    `Готово! Твой токен:\n\n<code>${apiKey}</code>` +
    (condition
      ? `\n\n${condition.tariffName}: ${condition.requestsLimit} запросов в сутки. Токен работает, пока ты в чате @omdb_dev и на канале @mdwit0r. Оплатишь любой тариф — условие снимается.`
      : ''),
  stopped: (tariffName: string, inChat: boolean, inChannel: boolean) => {
    const [left, comeBack] =
      !inChat && !inChannel
        ? ['из чата @omdb_dev и канала @mdwit0r', 'Вернись в чат и на канал']
        : !inChat
        ? ['из чата @omdb_dev', 'Вступи снова']
        : ['из канала @mdwit0r', 'Подпишись снова'];
    return (
      `⚠️ Токен остановлен: ты вышел ${left}.\n\n` +
      `На ${tariffName} токен работает, пока ты в чате @omdb_dev и на канале @mdwit0r. ${comeBack} — токен заработает. Оплатишь любой тариф — условие снимается.`
    );
  },
  resumed: '✅ Токен снова работает.',
};
