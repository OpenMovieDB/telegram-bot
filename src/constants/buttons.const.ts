import { CommandEnum } from '../enum/command.enum';
import { Markup } from 'telegraf';

export const BUTTONS = {
  [CommandEnum.BACK]: Markup.button.callback('⬅ назад', CommandEnum.BACK),
  [CommandEnum.HOME]: Markup.button.callback('📱в меню', CommandEnum.HOME),
  [CommandEnum.GET_ACCESS]: Markup.button.callback(
    'получить доступ 🚀',
    CommandEnum.GET_ACCESS,
  ),
  [CommandEnum.QUESTION]: Markup.button.callback(
    'задать вопрос 🥹',
    CommandEnum.QUESTION,
  ),
  [CommandEnum.I_HAVE_TOKEN]: Markup.button.callback(
    'уже есть токен 🤓',
    CommandEnum.I_HAVE_TOKEN,
  ),
  [CommandEnum.FREE_TARIFF]: Markup.button.callback(
    '200 🔥',
    CommandEnum.FREE_TARIFF,
  ),
  [CommandEnum.DEVELOPER_TARIFF]: Markup.button.callback(
    '5000 🔥🔥',
    CommandEnum.DEVELOPER_TARIFF,
  ),
  [CommandEnum.UNLIMITED_TARIFF]: Markup.button.callback(
    'БЕЗЛИМИТ 🔥🔥🔥',
    CommandEnum.UNLIMITED_TARIFF,
  ),
  [CommandEnum.JOIN_CHAT]: Markup.button.url(
    'вступить в чат 📣',
    'https://t.me/+jeHPZVXiLPFhODJi',
  ),
  [CommandEnum.CONFIRM_JOIN_CHAT]: Markup.button.callback(
    '🔥 я вступил в чат 🔥',
    CommandEnum.CONFIRM_JOIN_CHAT,
  ),
  [CommandEnum.GET_TOKEN]: Markup.button.callback(
    '👉получить токен👈',
    CommandEnum.GET_TOKEN,
  ),
  [CommandEnum.SEND_MESSAGE_TO_ADMIN]: Markup.button.url(
    'написать администратору 📩',
    'https://t.me/mdwit',
  ),
  [CommandEnum.GET_REQUEST_STATS]: Markup.button.callback(
    '📊 статистика',
    CommandEnum.GET_REQUEST_STATS,
  ),
  [CommandEnum.UPDATE_TARIFF]: Markup.button.callback(
    '🔥 сменить тариф',
    CommandEnum.UPDATE_TARIFF,
  ),
  [CommandEnum.GET_MY_TOKEN]: Markup.button.callback(
    '🔑 мой токен',
    CommandEnum.GET_MY_TOKEN,
  ),
};
