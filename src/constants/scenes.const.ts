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
        BUTTONS[CommandEnum.GET_MY_TOKEN],
      ],
      [BUTTONS[CommandEnum.QUESTION]],
    ],
  },
  [CommandEnum.GET_ACCESS]: {
    navigateText:
      'Для получения доступа к API тебе нужно выбрать тарифный план по количеству запросов в сутки.',
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
    text: `Тарифы: \n<b>${
      BUTTONS[CommandEnum.FREE_TARIFF].text
    }</b> - Всегда бесплатный.\n<b>${
      BUTTONS[CommandEnum.DEVELOPER_TARIFF].text
    }</b> - <i>500</i> рублей в месяц.\n<b>${
      BUTTONS[CommandEnum.UNLIMITED_TARIFF].text
    }</b> - <i>2000</i> рублей в месяц.`,
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
    text: `Если у тебя есть вопрос, то ты можешь задать его в нашем чате. \n\n Чтобы вступить в чат нажми на кнопку ниже.`,
    buttons: [BUTTONS[CommandEnum.JOIN_CHAT]],
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
  ERROR: (message: string) => ({
    navigateText: `Прошу прошения, но у меня тут ошибка: ${message}`,
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
  }),
};
