import { Test, TestingModule } from '@nestjs/testing';
import { TBankClient } from './tbank-client.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

describe('TBankClient', () => {
  let service: TBankClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TBankClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'TINKOFF_TERMINAL_KEY') return 'test-terminal';
              if (key === 'TINKOFF_PASSWORD') return 'test-password';
              return null;
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TBankClient>(TBankClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
