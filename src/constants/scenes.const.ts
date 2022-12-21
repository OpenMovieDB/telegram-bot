import { CommandEnum } from '../enum/command.enum';

const SCENES = {
  [CommandEnum.START]: {
    text: 'Привет! Я бот который поможет тебе получить токен для работы с API kinopoisk.dev. Для начала выбери действие:',
    buttons: [BUTTONS[CommandEnum.GET_ACCESS], BUTTONS[CommandEnum.QUESTION]],
  },
  [CommandEnum.GET_ACCESS]: {
    text: `Для получения доступа к API тебе нужно выбрать тарифный план. \n\nТарифы: \n${
      BUTTONS[CommandEnum.FREE_TARIFF]
    } - Всегда бесплатный.\n${
      BUTTONS[CommandEnum.DEVELOPER_TARIFF]
    } - 500 рублей в месяц.\n${
      BUTTONS[CommandEnum.UNLIMITED_TARIFF]
    } - 2000 рублей в месяц.`,
    buttons: [
      BUTTONS[CommandEnum.FREE_TARIFF],
      BUTTONS[CommandEnum.DEVELOPER_TARIFF],
      BUTTONS[CommandEnum.UNLIMITED_TARIFF],
    ],
    scenes: {
      [CommandEnum.FREE_TARIFF]: {
        text: `Отлично! Но перед этим к тебе есть небольшая просьба, зайди к нам в общий чат 😇\n В нем ты всегда можешь получить поддержку от сообщества и администрации, а в замен я дам тебе токен!`,
        buttons: [BUTTONS[CommandEnum.JOIN_CHAT]],
        scenes: {
          [BUTTONS[CommandEnum.JOIN_CHAT]]: {
            text: `Отлично, возвращайся сюда после вступления в чат!`,
            buttons: [BUTTONS[CommandEnum.CONFIRM_JOIN_CHAT]],
          },
          [BUTTONS[CommandEnum.CONFIRM_JOIN_CHAT]]: {
            success: {
              text: `Отлично! Теперь ты можешь получить токен!`,
              buttons: [BUTTONS[CommandEnum.GET_TOKEN]],
            },
            error: {
              text: `Ты еще не вступил в чат!`,
              buttons: [BUTTONS[CommandEnum.JOIN_CHAT]],
            },
          },
        },
      },
      [CommandEnum.DEVELOPER_TARIFF]: {
        text: `Оплата пока что не доступна, свяжитесь с администрацией для получения доступа. \n\n Главный разработчик: @mdwit`,
      },
      [CommandEnum.UNLIMITED_TARIFF]: {
        text: `Оплата пока что не доступна, свяжитесь с администрацией для получения доступа. \n\n Главный разработчик: @mdwit`,
      },
    },
  },
  [CommandEnum.QUESTION]: {
    text: `Если у тебя есть вопрос, то ты можешь задать его в нашем чате. \n\n Чтобы вступить в чат нажми на кнопку ниже.`,
    buttons: [BUTTONS[CommandEnum.JOIN_CHAT]],
  },
  [CommandEnum.GET_REQUEST_STATS]: {
    success: {
      text: `Вот статистика по использованию API:`,
    },
    error: {
      text: `Вы еще не зарегистрированы в системе, для этого вам нужно получить токен.`,
    },
  },
};
