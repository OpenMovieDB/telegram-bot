import { Test, TestingModule } from '@nestjs/testing';
import { StartScene } from './start.scene';
import { AccountClient } from '../account/account.client';
import { TariffService } from '../tariff/tariff.service';
import { SessionStateService } from '../session/session-state.service';
import { BillingTariff } from '../billing/billing.client';

const mockAccount = {
  id: 'acc-123',
  api_key: '',
  key_state: 'none',
  telegram_id: 42,
  telegram_username: 'tguser',
  tariff: { id: 't1', name: 'FREE', display_name: 'Демо', requests_limit: 200 },
};

const tariff = (over: Partial<BillingTariff>): BillingTariff => ({
  id: 'free-id',
  code: 'FREE',
  display_name: 'Демо',
  description: '',
  requests_limit: 200,
  is_default: true,
  is_hidden: false,
  is_popular: false,
  features: [],
  sort_order: 0,
  status: 'active',
  version: 1,
  prices: [],
  ...over,
});

const catalog = [
  tariff({}),
  tariff({
    id: 'basic-id',
    code: 'BASIC',
    display_name: 'Базовый',
    requests_limit: 5000,
    is_default: false,
    prices: [{ id: 'p1', months: 1, price_kopecks: 250000, discount_kopecks: 0, currency: 'RUB' }],
  }),
];

function makeCtx(overrides: Record<string, any> = {}) {
  return {
    from: { id: 42, username: 'tguser' },
    chat: { id: 42 },
    session: {} as Record<string, any>,
    replyWithHTML: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function callbackData(keyboard: any): string[] {
  return keyboard.reply_markup.inline_keyboard.flat().map((button: any) => button.callback_data ?? button.url);
}

describe('StartScene', () => {
  let scene: StartScene;
  let accountClient: jest.Mocked<AccountClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartScene,
        { provide: AccountClient, useValue: { upsertByTelegramId: jest.fn().mockResolvedValue(mockAccount) } },
        {
          provide: TariffService,
          useValue: {
            getAllTariffs: jest.fn().mockResolvedValue(catalog),
            getOneById: jest.fn((id: string) => Promise.resolve(catalog.find((t) => t.id === id))),
          },
        },
        { provide: SessionStateService, useValue: { setTariffId: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    scene = module.get<StartScene>(StartScene);
    accountClient = module.get(AccountClient);
  });

  it('registers the user and stores accountId in session', async () => {
    const ctx = makeCtx();
    await scene.onSceneEnter(ctx as any);

    expect(accountClient.upsertByTelegramId).toHaveBeenCalledWith(42, 'tguser');
    expect(ctx.session.accountId).toBe('acc-123');
  });

  it('shows the tariffs, the free one included, with a button per tariff', async () => {
    const ctx = makeCtx();
    await scene.onSceneEnter(ctx as any);

    const [text, keyboard] = (ctx.replyWithHTML as jest.Mock).mock.calls[0];
    expect(text).toContain('Вижу, ты новенький');
    expect(text).toContain('Бесплатно: участие в чате и подписка на канал');
    expect(text).toContain('2500 руб./месяц');
    expect(callbackData(keyboard)).toEqual(
      expect.arrayContaining(['tariff_free-id', 'tariff_basic-id', 'https://poiskkino.dev/documentation']),
    );
  });

  it('brings the tariffs back into the pressed message on «назад»', async () => {
    const ctx = makeCtx({ callbackQuery: { data: 'membership_back' } });
    await scene.onSceneEnter(ctx as any);

    expect(ctx.replyWithHTML).not.toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Наши условия'),
      expect.objectContaining({ parse_mode: 'HTML' }),
    );
  });

  it('carries these tariffs to the period screen, so «назад» comes back here', async () => {
    const enter = jest.fn().mockResolvedValue(undefined);
    const ctx = makeCtx({
      match: ['tariff_basic-id', 'basic-id'],
      answerCbQuery: jest.fn().mockResolvedValue(undefined),
      scene: { enter },
    });
    await scene.onTariffPick(ctx as any);

    expect(enter).toHaveBeenCalledWith('SELECT_MONTHS', { tariffsScene: 'START' });
  });
});
