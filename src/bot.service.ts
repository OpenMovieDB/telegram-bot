import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';

import { InjectBot } from 'nestjs-telegraf';
import { BOT_NAME } from './constants/bot-name.const';
import { User as TelegramUser } from 'typegram/manage';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { SafeTelegramHelper } from './helpers/safe-telegram.helper';
import { AccountClient } from './account/account.client';
import { AccountResponseDto } from './account/dto/account-response.dto';
import { TariffService, isFreeTariff } from './tariff/tariff.service';

@Injectable()
export class BotService {
  private readonly chatId: string;
  private readonly adminChatId: string;
  private readonly isProd: boolean;

  private readonly logger = new Logger(BotService.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly accountClient: AccountClient,
    private readonly tariffService: TariffService,
    private readonly configService: ConfigService,
  ) {
    this.chatId = configService.get('CHAT_ID');
    this.adminChatId = configService.get('ADMIN_CHAT_ID');
    this.isProd = configService.get('NODE_ENV') === 'production';
  }

  async sendMessage(chatId: number, message: string): Promise<void> {
    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(chatId, message),
      `Message to chat ${chatId}`,
    );
  }

  async sendPaymentSuccessMessage(chatId: number, tariffName: string, subscriptionEndDate?: Date): Promise<void> {
    const until = subscriptionEndDate
      ? DateTime.fromJSDate(subscriptionEndDate).toFormat('dd MMMM yyyy', { locale: 'ru' })
      : '∞';
    const message = `Тариф ${tariffName} успешно оплачен 🎉 \n\nПодписка действует до: ${until}\n\nВы можете продолжить использование бота.`;

    // Send message with home menu button to trigger scene exit
    await SafeTelegramHelper.safeSend(
      () =>
        this.bot.telegram.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [[{ text: '🏠 В главное меню', callback_data: 'home_menu' }]],
          },
        }),
      `Payment success message to chat ${chatId}`,
    );
  }

  // Amounts arrive from billing already totalled (rubles) — no bot-side math.
  async sendPaymentSuccessMessageToAdmin(
    username: string,
    tariffName: string,
    monthCount: number,
    amountRub: number,
    provider: string,
    discountRub?: number,
    originalRub?: number,
  ): Promise<void> {
    let message = `Пользователь ${username} оплатил тариф ${tariffName} на срок ${monthCount} мес.\n`;

    if (discountRub && discountRub > 0) {
      message += `💰 Применена скидка за переход с другого тарифа:\n`;
      message += `├ Полная стоимость: ${originalRub} ₽\n`;
      message += `├ Скидка: -${discountRub} ₽\n`;
      message += `└ Оплачено: ${amountRub} ₽\n`;
    } else {
      message += `💰 Оплаченная сумма: ${amountRub} ₽\n`;
    }

    message += `Платежная система: ${provider} 🎉`;

    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(this.adminChatId, message),
      'Admin payment notification',
    );
  }

  async sendInvoicePaidMessageToAdmin(description: string, amountRub: number, provider: string): Promise<void> {
    const message = `🧾 Счет оплачен: ${
      description || 'без описания'
    }\n💰 Сумма: ${amountRub} ₽\nПлатежная система: ${provider}`;
    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(this.adminChatId, message),
      'Admin invoice paid notification',
    );
  }

  async sendSubscriptionExpiredMessage(chatId: number) {
    const message = 'Срок действия вашей подписки истек. Тариф был изменен на бесплатный 🫣';
    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(chatId, message),
      `Subscription expired notification to ${chatId}`,
    );
  }

  async sendSubscriptionExpirationWarningMessage(chatId: number, expirationDate: Date) {
    const message = `Срок действия вашей подписки истекает ${DateTime.fromJSDate(expirationDate).toFormat(
      'dd.MM.yyyy',
    )} ⚠️ Пожалуйста, не забудьте продлить свою подписку.`;
    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(chatId, message),
      `Subscription warning to ${chatId}`,
    );
  }

  // All accounts with a linked Telegram, fetched page by page from account-service.
  private async collectTelegramAccounts(filter: { inChat?: boolean } = {}): Promise<AccountResponseDto[]> {
    const accounts: AccountResponseDto[] = [];
    const limit = 200;
    for (let page = 1; ; page++) {
      const { items, total } = await this.accountClient.listAccounts({ hasTelegram: true, ...filter, page, limit });
      accounts.push(...items);
      if (accounts.length >= total || items.length === 0) break;
    }
    return accounts;
  }

  async createInvitedUser(ctx: Context) {
    const members: TelegramUser[] = ctx.update?.['message']?.['new_chat_members'];
    this.logger.log(`NewChatMembers: ${members.map((member: any) => member.username).join(', ')}`);

    if (members) {
      for (const member of members) {
        try {
          const account = await this.accountClient.upsertByTelegramId(member.id, member?.username || undefined);
          await this.accountClient.updateTelegramProfile(account.id, { inChat: true });
          this.logger.log(`Account ${account.id} marked in_chat for telegram ${member.id}`);
        } catch (e) {
          this.logger.error(`Failed to register invited user ${member.username} (${member.id}):`, e);
        }
      }
    }
  }

  async leftTheChat(ctx: Context) {
    const account = await this.accountClient.getByTelegramId(ctx.from.id);
    if (!account) return;

    await this.accountClient.updateTelegramProfile(account.id, { inChat: false });
    this.logger.log(`User ${ctx.from.username} marked out of chat`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkUsers() {
    if (process.env.DISABLE_SCHEDULERS === 'true') return;
    this.logger.log('Check users');
    if (!this.isProd) return;

    const accounts = await this.collectTelegramAccounts({ inChat: true });
    this.logger.log(`Users in chat: ${accounts.length}`);

    const leavedUsers: AccountResponseDto[] = [];
    for (const account of accounts) {
      try {
        const { status } = await this.bot.telegram.getChatMember(this.chatId, account.telegram_id);
        if (status === 'left') leavedUsers.push(account);
      } catch (e) {
        // A network blip is NOT a verdict about the user — skip them this run
        // instead of mass-marking people as gone while Telegram is unreachable.
        if (SafeTelegramHelper.isRecoverableError(e)) continue;
        // Telegram definitively refuses to resolve the member (deleted account
        // etc.) — treat free-tariff users as gone, keep paying ones. The sweep
        // lists identity-only rows, so fetch this user's entitlement lazily on
        // this rare delete-resolution path instead of N+1-ing the whole roster.
        const full = await this.accountClient.getById(account.id);
        const tariff = full.tariff?.id ? await this.tariffService.getOneById(full.tariff.id) : null;
        if (tariff && isFreeTariff(tariff)) leavedUsers.push(account);
      }
    }

    if (leavedUsers.length) {
      await SafeTelegramHelper.safeSend(
        () =>
          this.bot.telegram.sendMessage(
            this.adminChatId,
            `😵‍💫Пользователи, которые вчера покинули чат: ${leavedUsers
              .map((account) => account.telegram_username || account.telegram_id)
              .join(', ')}`,
          ),
        'Admin notification: users left chat',
      );
      await this.markLeftChat(leavedUsers);
    } else {
      await SafeTelegramHelper.safeSend(
        () => this.bot.telegram.sendMessage(this.adminChatId, '😎 Никто не покинул чат'),
        'Admin notification: no users left chat',
      );
    }
  }

  private async markLeftChat(accounts: AccountResponseDto[]) {
    try {
      await Promise.all(
        accounts.map((account) => {
          this.logger.log(`Account ${account.id} (${account.telegram_username}) marked out of chat`);
          return this.accountClient.updateTelegramProfile(account.id, { inChat: false });
        }),
      );
    } catch (e) {
      this.logger.error(e);
    }
  }
}
