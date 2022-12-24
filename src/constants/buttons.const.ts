import { CommandEnum } from '../enum/command.enum';
import { Markup } from 'telegraf';

export const BUTTONS = {
  [CommandEnum.BACK]: Markup.button.callback('⬅ назад', CommandEnum.BACK),
  [CommandEnum.HOME]: Markup.button.callback('🏠 в начало', CommandEnum.HOME),
  [CommandEnum.GET_ACCESS]: Markup.button.callback(
    'Я хочу получить доступ к API 🚀',
    CommandEnum.GET_ACCESS,
  ),
  [CommandEnum.QUESTION]: Markup.button.callback(
    'У меня есть вопрос 🥹',
    CommandEnum.QUESTION,
  ),
  [CommandEnum.I_HAVE_TOKEN]: Markup.button.callback(
    'У меня уже есть токен 🤓',
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
    'Безлимит 🔥🔥🔥',
    CommandEnum.UNLIMITED_TARIFF,
  ),
  [CommandEnum.JOIN_CHAT]: Markup.button.url(
    'Вступить в чат',
    'https://t.me/+jeHPZVXiLPFhODJi',
  ),
  [CommandEnum.CONFIRM_JOIN_CHAT]: Markup.button.callback(
    'Я вступил в чат',
    CommandEnum.CONFIRM_JOIN_CHAT,
  ),
  [CommandEnum.GET_TOKEN]: Markup.button.callback(
    'Получить токен',
    CommandEnum.GET_TOKEN,
  ),
};
