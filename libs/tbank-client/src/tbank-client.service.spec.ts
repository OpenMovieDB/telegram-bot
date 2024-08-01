import { Test, TestingModule } from '@nestjs/testing';
import { TbankClientService } from './tbank-client.service';

describe('TbankClientService', () => {
  let service: TbankClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TbankClientService],
    }).compile();

    service = module.get<TbankClientService>(TbankClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
