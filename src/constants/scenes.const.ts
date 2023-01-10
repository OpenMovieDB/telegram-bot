import { CommandEnum } from '../enum/command.enum';
import { BUTTONS } from './buttons.const';

export const SCENES = {
  [CommandEnum.START]: {
    navigateText:
      'Привет! Я бот который поможет тебе получить токен для работы с API kinopoisk.dev. \n\n Для начала выбери действие:',
    navigateButtons: [
      [BUTTONS[CommandEnum.GET_ACCESS]],
      [BUTTONS[CommandEnum.I_HAVE_TOKEN], BUTTONS[CommandEnum.QUESTION]],
    ],
  },
  [CommandEnum.HOME]: {
    navigateText: 'Выбери действие:',
    navigateButtons: [
      [
        BUTTONS[CommandEnum.GET_REQUEST_STATS],
        BUTTONS[CommandEnum.UPDATE_MOVIE],
      ],
      [BUTTONS[CommandEnum.GET_MY_TOKEN], BUTTONS[CommandEnum.CHANGE_TOKEN]],
      [BUTTONS[CommandEnum.QUESTION]],
    ],
  },
  [CommandEnum.GET_ACCESS]: {
    navigateText:
      'Для получения доступа к API тебе нужно выбрать тарифный план по количеству запросов в сутки.',
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
    text: `Тарифы: \n\n<b>${
      BUTTONS[CommandEnum.FREE_TARIFF].text
    }</b>: <i>200</i> запросов в сутки. <b>Всегда бесплатно</b>.\n<b>${
      BUTTONS[CommandEnum.DEVELOPER_TARIFF].text
    }</b>: <i>5000</i> запросов в сутки. <b>500</b> руб./месяц.\n<b>${
      BUTTONS[CommandEnum.UNLIMITED_TARIFF].text
    }</b>: <i>∞</i> запросов в сутки. <b>2000</b> руб./месяц.`,
    buttons: [
      [BUTTONS[CommandEnum.FREE_TARIFF], BUTTONS[CommandEnum.DEVELOPER_TARIFF]],
      [BUTTONS[CommandEnum.UNLIMITED_TARIFF]],
    ],
  },
  [CommandEnum.FREE_TARIFF]: {
    navigateText:
      'Отлично! Но перед этим к тебе есть небольшая просьба, зайди к нам в общий чат 😇',
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
    text: `В нем ты всегда можешь получить поддержку от сообщества и администрации, а в замен я дам тебе токен!`,
    buttons: [
      BUTTONS[CommandEnum.JOIN_CHAT],
      BUTTONS[CommandEnum.CONFIRM_JOIN_CHAT],
    ],
    actions: {
      [CommandEnum.CONFIRM_JOIN_CHAT]: {
        success: (token: string) => ({
          navigateText: `Теперь, ты можешь пользоваться API: \n\n<code>${token}</code>`,
          navigateButtons: [BUTTONS[CommandEnum.HOME]],
        }),
        error: () => ({
          navigateText: `Ты не вступил в чат 😔`,
          navigateButtons: [BUTTONS[CommandEnum.HOME]],
          text: `Нажми на кнопку ниже и вступи в чат, а затем вернись сюда и нажми на кнопку "Подтвердить вступление"`,
          buttons: [
            BUTTONS[CommandEnum.JOIN_CHAT],
            BUTTONS[CommandEnum.CONFIRM_JOIN_CHAT],
          ],
        }),
      },
    },
  },
  [CommandEnum.DEVELOPER_TARIFF]: {
    text: `Оплата пока что не доступна, свяжитесь с администрацией для получения доступа.`,
    buttons: [BUTTONS[CommandEnum.SEND_MESSAGE_TO_ADMIN]],
  },
  [CommandEnum.UNLIMITED_TARIFF]: {
    text: `Оплата пока что не доступна, свяжитесь с администрацией для получения доступа.`,
    buttons: [BUTTONS[CommandEnum.SEND_MESSAGE_TO_ADMIN]],
  },
  [CommandEnum.QUESTION]: {
    text: `Если у тебя есть вопрос, то ты можешь, посмотреть в документацию или задать его в нашем чате.`,
    buttons: [
      BUTTONS[CommandEnum.JOIN_CHAT],
      BUTTONS[CommandEnum.DOCUMENTATION],
    ],
  },
  [CommandEnum.GET_REQUEST_STATS]: {
    success: (requests: number, leftRequests: number) => ({
      text: `Вот статистика по использованию API:\n\n<b>Использовано:</b> <i>${requests}</i>\n<b>Осталось запросов:</b> <i>${leftRequests}</i>`,
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
    }),
    error: () => ({
      text: `У тебя еще нет токена. \n\n Чтобы получить токен, нажми на кнопку ниже.`,
      buttons: [BUTTONS[CommandEnum.GET_ACCESS]],
    }),
  },
  [CommandEnum.CHANGE_TOKEN]: {
    text: `Ты точно хочешь сменить токен? \n\n Его необходимо будет поменять во всех приложениях, которые используют его.`,
    buttons: [BUTTONS[CommandEnum.YES], BUTTONS[CommandEnum.NO]],
    actions: {
      [CommandEnum.YES]: {
        success: (token: string) => ({
          text: `Вот новый токен: \n\n<code>${token}</code>`,
        }),
        error: () => ({
          text: `У тебя еще нет токена. \n\n Чтобы получить токен, нажми на кнопку ниже.`,
          buttons: [BUTTONS[CommandEnum.GET_ACCESS]],
        }),
      },
      [CommandEnum.NO]: {
        text: `Отлично!`,
      },
    },
  },
  [CommandEnum.UPDATE_MOVIE]: {
    text: `Я могу обновить или добавить фильмы. Пожалуйста, пришли мне список ID из кинопоиска разделенные запятой. \n\n Например: 666, 326, 435. \n\n Учитывай пожалуйста, что на обновление фильмов может потребоваться некоторое время. А так же, учитывай, что кеш действует сутки. Чтобы посмотреть результат без кеша, добавь в запрос параметр v= и любым значением.`,
    buttons: [BUTTONS[CommandEnum.BACK]],
    success: {
      text: `Выполнено! Этот список фильмов добавлен в приоритетную очередь на обновение`,
    },
    error: {
      text: `Что-то пошло не так 😨`,
      buttons: [BUTTONS[CommandEnum.BACK]],
    },
  },
  ERROR: (message: string) => ({
    navigateText: `Прошу прошения, но у меня тут ошибка: ${message}`,
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
  }),
};
