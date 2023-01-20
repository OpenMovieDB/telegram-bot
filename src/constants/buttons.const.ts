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
    'FREE',
    CommandEnum.FREE_TARIFF,
  ),
  [CommandEnum.DEVELOPER_TARIFF]: Markup.button.callback(
    'DEVELOPER',
    CommandEnum.DEVELOPER_TARIFF,
  ),
  [CommandEnum.UNLIMITED_TARIFF]: Markup.button.callback(
    'UNLIMIT',
    CommandEnum.UNLIMITED_TARIFF,
  ),
  [CommandEnum.JOIN_CHAT]: Markup.button.url(
    'вступить в чат 📣',
    'https://t.me/+hdOSHbV8SJo2NmJi',
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
  [CommandEnum.CHANGE_TOKEN]: Markup.button.callback(
    '✏️ сменить токен',
    CommandEnum.CHANGE_TOKEN,
  ),
  [CommandEnum.YES]: Markup.button.callback('✅ да', CommandEnum.YES),
  [CommandEnum.NO]: Markup.button.callback('❌ нет', CommandEnum.NO),
  [CommandEnum.DOCUMENTATION]: Markup.button.url(
    '📑 документация',
    'https://kinopoiskdev.docs.apiary.io/',
  ),
  [CommandEnum.UPDATE_MOVIE]: Markup.button.callback(
    '🔄️ обновить фильмы',
    CommandEnum.UPDATE_MOVIE,
  ),
  [CommandEnum.SET_IMDB_RELATION]: Markup.button.callback(
    '🔗 связать с IMDB',
    CommandEnum.SET_IMDB_RELATION,
  ),
};
