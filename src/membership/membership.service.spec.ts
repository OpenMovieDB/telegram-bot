import { MembershipService } from './membership.service';
import { MembershipCheckWire } from '../account/dto/account-response.dto';

const account = {
  id: 'acc-1',
  api_key: 'KEY-1',
  key_state: 'active',
  telegram_id: 42,
  tariff: { id: 't1', name: 'FREE', display_name: 'Демо', requests_limit: 200 },
};

const check = (over: Partial<MembershipCheckWire>): MembershipCheckWire => ({
  membership_required: true,
  telegram_linked: true,
  in_chat: true,
  in_channel: true,
  key_state: 'active',
  key_state_before: 'active',
  ...over,
});

function makeCtx(overrides: Record<string, any> = {}) {
  return {
    from: { id: 42 },
    session: {} as Record<string, any>,
    callbackQuery: { data: 'membership_check' },
    answerCbQuery: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
    replyWithHTML: jest.fn().mockResolvedValue(undefined),
    scene: { enter: jest.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
}

function buttons(markup: any): string[] {
  return markup.reply_markup.inline_keyboard.flat().map((button: any) => button.callback_data ?? button.url);
}

describe('MembershipService', () => {
  let accountClient: Record<string, jest.Mock>;
  let sendMessage: jest.Mock;
  let service: MembershipService;

  beforeEach(() => {
    accountClient = {
      getByTelegramId: jest.fn().mockResolvedValue(account),
      getById: jest.fn().mockResolvedValue(account),
      checkMembership: jest.fn(),
    };
    sendMessage = jest.fn().mockResolvedValue(undefined);
    service = new MembershipService({ telegram: { sendMessage } } as any, accountClient as any);
  });

  describe('steps', () => {
    it('starts with the chat when the user is in neither', async () => {
      accountClient.checkMembership.mockResolvedValue(
        check({ in_chat: false, in_channel: false, key_state: 'none', key_state_before: 'none' }),
      );
      const ctx = makeCtx();
      await service.startSteps(ctx as any, 'acc-1');

      const [text, extra] = ctx.editMessageText.mock.calls[0];
      expect(text).toContain('Шаг 1 из 2');
      expect(buttons(extra)).toEqual(['https://t.me/+hdOSHbV8SJo2NmJi', 'membership_check:chat', 'membership_back']);
    });

    it('skips the chat step for a user already in the chat', async () => {
      accountClient.checkMembership.mockResolvedValue(
        check({ in_channel: false, key_state: 'none', key_state_before: 'none' }),
      );
      const ctx = makeCtx();
      await service.startSteps(ctx as any, 'acc-1');

      const [text, extra] = ctx.editMessageText.mock.calls[0];
      expect(text).toContain('Шаг 2 из 2');
      expect(buttons(extra)).toEqual(['https://t.me/mdwit0r', 'membership_check:channel', 'membership_back']);
    });

    it('shows the key with its condition once both are met', async () => {
      accountClient.checkMembership.mockResolvedValue(check({ key_state_before: 'none' }));
      const ctx = makeCtx();
      await service.onStepCheck(ctx as any);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith();
      const [text, extra] = ctx.editMessageText.mock.calls[0];
      expect(text).toContain('<code>KEY-1</code>');
      expect(text).toContain('Демо: 200 запросов в сутки');
      expect(buttons(extra)).toEqual(['https://poiskkino.dev/documentation', 'HOME']);
    });

    it('moves from a passed chat step to the channel without an alert', async () => {
      accountClient.checkMembership.mockResolvedValue(
        check({ in_channel: false, key_state: 'none', key_state_before: 'none' }),
      );
      const ctx = makeCtx();
      await service.onStepCheck(ctx as any, 'chat');

      expect(ctx.answerCbQuery).toHaveBeenCalledWith();
      expect(ctx.editMessageText.mock.calls[0][0]).toContain('Шаг 2 из 2');
    });

    it('alerts when the chat step is not passed', async () => {
      accountClient.checkMembership.mockResolvedValue(
        check({ in_chat: false, in_channel: false, key_state: 'none', key_state_before: 'none' }),
      );
      const ctx = makeCtx();
      await service.onStepCheck(ctx as any, 'chat');

      expect(ctx.answerCbQuery).toHaveBeenCalledWith(expect.stringContaining('@omdb_dev'), { show_alert: true });
    });

    it('alerts when the channel step is not passed', async () => {
      accountClient.checkMembership.mockResolvedValue(
        check({ in_channel: false, key_state: 'none', key_state_before: 'none' }),
      );
      const ctx = makeCtx();
      await service.onStepCheck(ctx as any, 'channel');

      expect(ctx.answerCbQuery).toHaveBeenCalledWith(expect.stringContaining('@mdwit0r'), { show_alert: true });
    });

    it('alerts and returns to the chat when the user left it before the channel step', async () => {
      accountClient.checkMembership.mockResolvedValue(
        check({ in_chat: false, in_channel: false, key_state: 'none', key_state_before: 'none' }),
      );
      const ctx = makeCtx();
      await service.onStepCheck(ctx as any, 'channel');

      expect(ctx.answerCbQuery).toHaveBeenCalledWith(expect.stringContaining('@omdb_dev'), { show_alert: true });
      expect(ctx.editMessageText.mock.calls[0][0]).toContain('Шаг 1 из 2');
    });

    it('alerts on anything missing under a button sent without the step', async () => {
      accountClient.checkMembership.mockResolvedValue(
        check({ in_channel: false, key_state: 'none', key_state_before: 'none' }),
      );
      const ctx = makeCtx();
      await service.onStepCheck(ctx as any);

      expect(ctx.answerCbQuery).toHaveBeenCalledWith(expect.stringContaining('@mdwit0r'), { show_alert: true });
    });

    it('sends a user without an account back to the tariffs', async () => {
      accountClient.getByTelegramId.mockResolvedValue(null);
      const ctx = makeCtx();
      await service.onStepCheck(ctx as any);

      expect(accountClient.checkMembership).not.toHaveBeenCalled();
      expect(ctx.scene.enter).toHaveBeenCalledWith('START');
    });
  });

  describe('chat_member', () => {
    const update = (userId: number, isBot = false) =>
      ({ new_chat_member: { user: { id: userId, is_bot: isBot } } } as any);

    it('tells the owner the key stopped, naming what they left', async () => {
      accountClient.checkMembership.mockResolvedValue(check({ in_channel: false, key_state: 'stopped' }));
      await service.onChatMember(update(42));

      const [chatId, text, extra] = sendMessage.mock.calls[0];
      expect(chatId).toBe(42);
      expect(text).toContain('ты вышел из канала @mdwit0r');
      expect(buttons(extra)).toEqual(['https://t.me/mdwit0r', 'membership_resume', 'UPDATE_TARIFF']);
    });

    it('tells the owner the key works again', async () => {
      accountClient.checkMembership.mockResolvedValue(check({ key_state_before: 'stopped' }));
      await service.onChatMember(update(42));

      expect(sendMessage).toHaveBeenCalledWith(42, '✅ Токен снова работает.', expect.anything());
    });

    it('stays silent when the key did not change', async () => {
      accountClient.checkMembership.mockResolvedValue(
        check({ in_channel: false, key_state: 'none', key_state_before: 'none' }),
      );
      await service.onChatMember(update(42));

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('ignores bots and users without an account', async () => {
      await service.onChatMember(update(7, true));
      accountClient.getByTelegramId.mockResolvedValue(null);
      await service.onChatMember(update(8));

      expect(accountClient.checkMembership).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });
});
