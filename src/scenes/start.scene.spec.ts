import { Test, TestingModule } from '@nestjs/testing';
import { StartScene } from './start.scene';
import { AccountClient } from '../account/account.client';

const mockAccount = {
  id: 'acc-123',
  api_key: 'APIKEY-FROM-ACCOUNT',
  telegram_id: 42,
  telegram_username: 'tguser',
  tariff: { id: 't1', name: 'Free', requests_limit: 100 },
};

function makeCtx(overrides: Record<string, any> = {}) {
  return {
    from: { id: 42, username: 'tguser' },
    chat: { id: 42 },
    session: {} as Record<string, any>,
    replyWithHTML: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('StartScene', () => {
  let scene: StartScene;
  let accountClient: jest.Mocked<AccountClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartScene,
        {
          provide: AccountClient,
          useValue: { upsertByTelegramId: jest.fn().mockResolvedValue(mockAccount) },
        },
      ],
    }).compile();

    scene = module.get<StartScene>(StartScene);
    accountClient = module.get(AccountClient);
  });

  it('calls accountClient.upsertByTelegramId and stores accountId in session', async () => {
    const ctx = makeCtx();
    await scene.onSceneEnter(ctx as any);

    expect(accountClient.upsertByTelegramId).toHaveBeenCalledWith(42, 'tguser');
    expect(ctx.session.accountId).toBe('acc-123');
  });

  it('passes account api_key to replyWithHTML', async () => {
    const ctx = makeCtx();
    await scene.onSceneEnter(ctx as any);

    expect(ctx.replyWithHTML).toHaveBeenCalled();
    const callArg = (ctx.replyWithHTML as jest.Mock).mock.calls[0][0] as string;
    expect(callArg).toContain('APIKEY-FROM-ACCOUNT');
  });
});
