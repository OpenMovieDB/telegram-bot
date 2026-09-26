import { BotUpdate } from './bot.update';
import { TelegramAlreadyLinkedError } from './account/account.client';

const TOKEN = 'a'.repeat(16) + 'b'.repeat(48);

function makeBotUpdate() {
  const accountClient = {
    getTelegramAuthRequest: jest.fn(),
    confirmTelegramAuth: jest.fn(),
    declineTelegramAuth: jest.fn().mockResolvedValue(undefined),
  };
  const update = new BotUpdate(
    {} as any,
    {} as any,
    {} as any,
    { get: jest.fn().mockReturnValue('1') } as any,
    {} as any,
    {} as any,
    {} as any,
    accountClient as any,
    {} as any,
  );
  return { update, accountClient };
}

function makeCtx(overrides: Record<string, any> = {}) {
  return {
    from: { id: 42, username: 'tguser', first_name: 'Ivan' },
    chat: { id: 42, type: 'private' },
    update: { message: { chat: { type: 'private' } } },
    state: { command: { args: [TOKEN] } },
    session: {} as Record<string, any>,
    reply: jest.fn().mockResolvedValue(undefined),
    answerCbQuery: jest.fn().mockResolvedValue(undefined),
    editMessageReplyMarkup: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buttons(reply: jest.Mock) {
  const [, extra] = reply.mock.calls[0];
  return extra.reply_markup.inline_keyboard.flat().map((button: any) => [button.text, button.callback_data]);
}

describe('BotUpdate — dashboard sign-in and link', () => {
  it('asks before a link and names the account that gets this Telegram', async () => {
    const { update, accountClient } = makeBotUpdate();
    accountClient.getTelegramAuthRequest.mockResolvedValue({ flow: 'link', email: 'owner@example.com' });
    const ctx = makeCtx();

    await update.onStart(ctx as any);

    expect(accountClient.getTelegramAuthRequest).toHaveBeenCalledWith(TOKEN, 42);
    expect(accountClient.confirmTelegramAuth).not.toHaveBeenCalled();
    expect(ctx.reply.mock.calls[0][0]).toBe('Привязать этот Telegram к аккаунту ПоискКино owner@example.com?');
    expect(buttons(ctx.reply)).toEqual([
      ['✅ Привязать', 'dashboard_auth:ok:aaaaaaaaaaaaaaaa'],
      ['Отмена', 'dashboard_auth:no:aaaaaaaaaaaaaaaa'],
    ]);
    expect(ctx.session.dashboardAuthToken).toBe(TOKEN);
  });

  it('asks to join the accounts when this Telegram has its own account', async () => {
    const { update, accountClient } = makeBotUpdate();
    accountClient.getTelegramAuthRequest.mockResolvedValue({ flow: 'link', email: 'owner@example.com', merge: true });
    const ctx = makeCtx();

    await update.onStart(ctx as any);

    expect(ctx.reply.mock.calls[0][0]).toMatch(
      /^Объединить аккаунт этого Telegram с аккаунтом ПоискКино owner@example\.com\?/,
    );
    expect(buttons(ctx.reply)).toEqual([
      ['✅ Объединить', 'dashboard_auth:ok:aaaaaaaaaaaaaaaa'],
      ['Отмена', 'dashboard_auth:no:aaaaaaaaaaaaaaaa'],
    ]);
  });

  it('says the Telegram does not fit before asking anything', async () => {
    const { update, accountClient } = makeBotUpdate();
    accountClient.getTelegramAuthRequest.mockRejectedValue(new TelegramAlreadyLinkedError());
    const ctx = makeCtx();

    await update.onStart(ctx as any);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(
      '⚠️ Этот Telegram не подходит: он уже привязан к другому аккаунту ПоискКино.',
    );
    expect(ctx.session.dashboardAuthToken).toBeUndefined();
  });

  it('tells that the accounts were joined', async () => {
    const { update, accountClient } = makeBotUpdate();
    accountClient.confirmTelegramAuth.mockResolvedValue({ success: true, flow: 'link', merged: true });
    const ctx = makeCtx({ session: { dashboardAuthToken: TOKEN }, match: ['', 'ok', 'aaaaaaaaaaaaaaaa'] });

    await update.onDashboardAuthAnswer(ctx as any);

    expect(ctx.reply.mock.calls[0][0]).toBe('✅ Аккаунты объединены.\n\nМожете вернуться в браузер.');
  });

  it('confirms only on the press and forgets the remembered account after a link', async () => {
    const { update, accountClient } = makeBotUpdate();
    accountClient.confirmTelegramAuth.mockResolvedValue({ success: true, flow: 'link' });
    const ctx = makeCtx({
      session: { dashboardAuthToken: TOKEN, accountId: 'old' },
      match: ['', 'ok', 'aaaaaaaaaaaaaaaa'],
    });

    await update.onDashboardAuthAnswer(ctx as any);

    expect(accountClient.confirmTelegramAuth).toHaveBeenCalledWith(TOKEN, 42, 'tguser', 'Ivan');
    expect(ctx.session.dashboardAuthToken).toBeUndefined();
    expect(ctx.session.accountId).toBeUndefined();
  });

  it('never confirms a newer link from an older question', async () => {
    const { update, accountClient } = makeBotUpdate();
    const ctx = makeCtx({ session: { dashboardAuthToken: TOKEN }, match: ['', 'ok', 'cccccccccccccccc'] });

    await update.onDashboardAuthAnswer(ctx as any);

    expect(accountClient.confirmTelegramAuth).not.toHaveBeenCalled();
    expect(ctx.reply.mock.calls[0][0]).toContain('истекла или уже использована');
  });

  it('«Отмена» tells auth, so the dashboard stops waiting', async () => {
    const { update, accountClient } = makeBotUpdate();
    const ctx = makeCtx({ session: { dashboardAuthToken: TOKEN }, match: ['', 'no', 'aaaaaaaaaaaaaaaa'] });

    await update.onDashboardAuthAnswer(ctx as any);

    expect(accountClient.declineTelegramAuth).toHaveBeenCalledWith(TOKEN);
    expect(accountClient.confirmTelegramAuth).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Отменено.');
  });

  it('says the Telegram does not fit when another account holds it', async () => {
    const { update, accountClient } = makeBotUpdate();
    accountClient.confirmTelegramAuth.mockRejectedValue(new TelegramAlreadyLinkedError());
    const ctx = makeCtx({ session: { dashboardAuthToken: TOKEN }, match: ['', 'ok', 'aaaaaaaaaaaaaaaa'] });

    await update.onDashboardAuthAnswer(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      '⚠️ Этот Telegram не подходит: он уже привязан к другому аккаунту ПоискКино.',
    );
  });
});
