import { Test, TestingModule } from '@nestjs/testing';

import { CryptomusClientService } from './cryptomus-client.service';

describe('CryptomusClientService', () => {
  let service: CryptomusClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CryptomusClientService],
    }).compile();

    service = module.get<CryptomusClientService>(CryptomusClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
