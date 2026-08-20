import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { SessionStateService } from './session-state.service';

describe('SessionStateService', () => {
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  async function makeService(botToken?: string): Promise<SessionStateService> {
    const module = await Test.createTestingModule({
      providers: [
        SessionStateService,
        { provide: RedisService, useValue: { getOrThrow: () => redis } },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'BOT_TOKEN' ? botToken : undefined) } },
      ],
    }).compile();
    return module.get(SessionStateService);
  }

  beforeEach(() => jest.clearAllMocks());

  // Both bots share one Redis — a key without the bot id would leak scene
  // state (tariff choice, attemptId, exit flags) between the bots for a user
  // talking to both.
  it('scopes payment flags and message keys by bot id', async () => {
    const service = await makeService('8252040138:AAA-secret');

    await service.setTariffId(42, 'tariff-1');
    expect(redis.set).toHaveBeenCalledWith('payment_flags:8252040138:42', expect.any(String), 'EX', 3600);

    await service.setMessageId(42, 777);
    expect(redis.set).toHaveBeenCalledWith('message:8252040138:42', '777', 'EX', 86400);

    await service.getPaymentFlags(42);
    expect(redis.get).toHaveBeenCalledWith('payment_flags:8252040138:42');
  });

  it('refuses to start without BOT_TOKEN', async () => {
    await expect(makeService(undefined)).rejects.toThrow('BOT_TOKEN');
  });
});
