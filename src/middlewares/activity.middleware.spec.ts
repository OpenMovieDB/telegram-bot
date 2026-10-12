import { recordActivity } from './activity.middleware';
import { AccountClient } from '../account/account.client';

describe('recordActivity', () => {
  const make = (result: Promise<void>) => {
    const client = { recordActivity: jest.fn().mockReturnValue(result) } as unknown as AccountClient;
    return { client, middleware: recordActivity(client) };
  };

  it('records a person acting in a private chat and passes the update on', async () => {
    const { client, middleware } = make(Promise.resolve());
    const next = jest.fn().mockResolvedValue(undefined);

    await middleware({ chat: { type: 'private' }, from: { id: 42, is_bot: false } } as never, next);

    expect(client.recordActivity).toHaveBeenCalledWith(42);
    expect(next).toHaveBeenCalled();
  });

  it('skips group chats and bots', async () => {
    const { client, middleware } = make(Promise.resolve());
    const next = jest.fn().mockResolvedValue(undefined);

    await middleware({ chat: { type: 'supergroup' }, from: { id: 42, is_bot: false } } as never, next);
    await middleware({ chat: { type: 'private' }, from: { id: 7, is_bot: true } } as never, next);

    expect(client.recordActivity).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('answers the update when account-service fails', async () => {
    const { middleware } = make(Promise.reject(new Error('down')));
    const next = jest.fn().mockResolvedValue(undefined);

    await middleware({ chat: { type: 'private' }, from: { id: 42, is_bot: false } } as never, next);

    expect(next).toHaveBeenCalled();
  });
});
