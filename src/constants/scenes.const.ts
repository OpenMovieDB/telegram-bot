import { BUTTONS, ADMIN_KEYBOARD_BUTTONS } from './buttons.const';
import { CommandEnum } from '../enum/command.enum';
import { Tariff } from 'src/tariff/schemas/tariff.schema';
import { splitArrayIntoPairs } from 'src/utils/split-array-into-pairs';
import { DateTime } from 'luxon';

export const SCENES = {
  [CommandEnum.START]: {
    text: (token: string) =>
      `Привет! Вот твой токен для работы с API:\n\n<code>${token}</code>\n\nДокументация: <a href="https://poiskkino.dev/documentation">poiskkino.dev/documentation</a>`,
    buttons: [BUTTONS[CommandEnum.DOCUMENTATION], BUTTONS[CommandEnum.JOIN_CHAT]],
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
    text: (tariffs: Tariff[]) =>
      'Тарифы: \n\n' +
      tariffs
        .map(
          (tariff) =>
            `<b>${BUTTONS[CommandEnum[tariff.name + '_TARIFF']].text}</b>: <i>${
              tariff.requestsLimit > 99999999990 ? '∞' : tariff.requestsLimit
            }</i> запросов в сутки. <b>${tariff.price === 0 ? 'Всегда бесплатно' : tariff.price + 'руб./месяц'}</b>.\n`,
        )
        .join(''),
    buttons: (tariffs: Tariff[]) =>
      splitArrayIntoPairs(tariffs.map((tariff) => BUTTONS[CommandEnum[tariff.name + '_TARIFF']])),
  },
  [CommandEnum.UPDATE_TARIFF]: {
    text: (tariffs: Tariff[], currentTariff: string, subscriptionEndDate?: Date) =>
      `Ваш текущий тариф: <b>${currentTariff}</b>. \nДействует до: ${
        subscriptionEndDate ? DateTime.fromJSDate(subscriptionEndDate).toFormat('dd MMMM yyyy', { locale: 'ru' }) : '∞'
      }\n\n` +
      'Доступные тарифы: \n' +
      tariffs
        .map(
          (tariff) =>
            `<b>${BUTTONS[CommandEnum[tariff.name + '_TARIFF']].text}</b>: <i>${
              tariff.requestsLimit > 99999999990 ? '∞' : tariff.requestsLimit
            }</i> запросов в сутки. <b>${tariff.price === 0 ? 'Всегда бесплатно' : tariff.price + 'руб./месяц'}</b>.\n`,
        )
        .join(''),
    buttons: (tariffs: Tariff[]) =>
      splitArrayIntoPairs(tariffs.map((tariff) => BUTTONS[CommandEnum[tariff.name + '_TARIFF']])),
  },
  [CommandEnum.PAYMENT]: {
    text: `Выберите способ оплаты:`,
    buttons: [[BUTTONS[CommandEnum.PAY_WITH_TBANK], BUTTONS[CommandEnum.PAY_WITH_CRYPTOMUS]]],
    actions: {
      [CommandEnum.PAY_WITH_CRYPTOMUS]: {
        text: `Чтобы оплатить подписку для выбранного вами тарифа, вам нужно перейти к оплате, нажав на кнопку ниже.\n\nПосле того как вы оплатите, я автоматически вам поменяю тариф.`,
      },
      [CommandEnum.CONFIRM_PAYMENT]: {
        success: (tariffName: string) => ({
          navigateText: `Поздравляю, твой тариф изменен, на <code>${tariffName}</code>`,
          navigateButtons: [BUTTONS[CommandEnum.HOME]],
        }),
        error: () => ({
          navigateText: `Оплата еще в процессе, или ты еще ее не произвел. Я сообщу когда тариф обновится`,
          navigateButtons: [BUTTONS[CommandEnum.HOME]],
          text: `Если ничего не произошло, то нажмите на кнопку ниже. Или напишите @mdwit`,
          buttons: [BUTTONS[CommandEnum.CONFIRM_PAYMENT]],
        }),
      },
    },
  },
  [CommandEnum.FREE_TARIFF]: {
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
    text: (token: string) =>
      `Твой токен для работы с API: \n\n<code>${token}</code>\n\nДокументация по API: <code>https://poiskkino.dev/documentation</code>\nОна описана в формате OpenAPI и поможет тебе быстро составить запрос к API.\n\nЕсли тебе снова нужна будет документация, в основном меню будет кнопка "🆘 поддержка".`,
  },
  [CommandEnum.DEMO_TARIFF]: {
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
      buttons: [BUTTONS[CommandEnum.CHANGE_TOKEN], BUTTONS[CommandEnum.BACK]],
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
  ERROR: (message: string) => ({
    navigateText: `Прошу прошения, но у меня тут ошибка: ${message}`,
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
  }),
};
