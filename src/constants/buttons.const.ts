import { CommandEnum } from '../enum/command.enum';
import { Markup } from 'telegraf';

export const BUTTONS = {
  [CommandEnum.BACK]: Markup.button.callback('⬅ назад', CommandEnum.BACK),
  [CommandEnum.HOME]: Markup.button.callback('📱в меню', CommandEnum.HOME),
  [CommandEnum.GET_ACCESS]: Markup.button.callback('получить доступ 🚀', CommandEnum.GET_ACCESS),
  [CommandEnum.QUESTION]: Markup.button.callback('🆘 поддержка', CommandEnum.QUESTION),
  [CommandEnum.I_HAVE_TOKEN]: Markup.button.callback('уже есть токен 🤓', CommandEnum.I_HAVE_TOKEN),
  [CommandEnum.FREE_TARIFF]: Markup.button.callback('FREE', CommandEnum.FREE_TARIFF),
  [CommandEnum.DEVELOPER_TARIFF]: Markup.button.callback('DEVELOPER', CommandEnum.DEVELOPER_TARIFF),
  [CommandEnum.UNLIMITED_TARIFF]: Markup.button.callback('UNLIMITED', CommandEnum.UNLIMITED_TARIFF),
  [CommandEnum.STUDENT_TARIFF]: Markup.button.callback('STUDENT', CommandEnum.STUDENT_TARIFF),
  [CommandEnum.JOIN_CHAT]: Markup.button.url('вступить в чат 📣', 'https://t.me/+hdOSHbV8SJo2NmJi'),
  [CommandEnum.CONFIRM_JOIN_CHAT]: Markup.button.callback('🔥 я вступил в чат 🔥', CommandEnum.CONFIRM_JOIN_CHAT),
  [CommandEnum.GET_TOKEN]: Markup.button.callback('👉получить токен👈', CommandEnum.GET_TOKEN),
  [CommandEnum.SEND_MESSAGE_TO_ADMIN]: Markup.button.url('написать администратору 📩', 'https://t.me/mdwit'),
  [CommandEnum.GET_REQUEST_STATS]: Markup.button.callback('📊 статистика', CommandEnum.GET_REQUEST_STATS),
  [CommandEnum.UPDATE_TARIFF]: Markup.button.callback('🔄️ тариф', CommandEnum.UPDATE_TARIFF),
  [CommandEnum.GET_MY_TOKEN]: Markup.button.callback('🫣 токен', CommandEnum.GET_MY_TOKEN),
  [CommandEnum.CHANGE_TOKEN]: Markup.button.callback('🔄 сменить токен', CommandEnum.CHANGE_TOKEN),
  [CommandEnum.YES]: Markup.button.callback('✅ да', CommandEnum.YES),
  [CommandEnum.NO]: Markup.button.callback('❌ нет', CommandEnum.NO),
  [CommandEnum.DOCUMENTATION]: Markup.button.url('📑 документация', 'https://poiskkino.dev/documentation'),
  [CommandEnum.UPDATE_MOVIE]: Markup.button.callback('🔄️ фильмы', CommandEnum.UPDATE_MOVIE),
  [CommandEnum.SET_IMDB_RELATION]: Markup.button.callback('🔗 с IMDB', CommandEnum.SET_IMDB_RELATION),
  [CommandEnum.PAY_WITH_WALLET]: Markup.button.callback('👛 кошельком в ТГ', CommandEnum.PAY_WITH_WALLET),
  [CommandEnum.PAY_WITH_CRYPTOMUS]: Markup.button.callback('🪙 криптовалютой', CommandEnum.PAY_WITH_CRYPTOMUS),
  [CommandEnum.PAY_WITH_YOOKASSA]: Markup.button.callback('💳 картой РФ', CommandEnum.PAY_WITH_YOOKASSA),
  [CommandEnum.PAY_WITH_TBANK]: Markup.button.callback('💳 картой РФ', CommandEnum.PAY_WITH_TBANK),
  [CommandEnum.CONFIRM_PAYMENT]: Markup.button.callback('✅ Я оплатил', CommandEnum.CONFIRM_PAYMENT),
  [CommandEnum.ADMIN_MENU]: Markup.button.callback('⚙️ Админ панель', CommandEnum.ADMIN_MENU),
  [CommandEnum.CREATE_USER]: Markup.button.callback('➕ Создать пользователя', CommandEnum.CREATE_USER),
  [CommandEnum.LIST_USERS]: Markup.button.callback('📋 Список пользователей', CommandEnum.LIST_USERS),
  [CommandEnum.EXPIRING_SUBSCRIPTIONS]: Markup.button.callback('⏰ Истекающие подписки', CommandEnum.EXPIRING_SUBSCRIPTIONS),
};

// Keyboard buttons for admin menu (must be Markup.button.text for keyboard)
export const ADMIN_KEYBOARD_BUTTONS = {
  CREATE_USER: Markup.button.text('➕ Создать пользователя'),
  LIST_USERS: Markup.button.text('📋 Список пользователей'),
  EXPIRING_SUBSCRIPTIONS: Markup.button.text('⏰ Истекающие подписки'),
  HOME: Markup.button.text('📱в меню'),
};
