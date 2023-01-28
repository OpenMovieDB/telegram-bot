import { Test, TestingModule } from '@nestjs/testing';
import { CriptomusClientService } from './criptomus-client.service';

describe('CriptomusClientService', () => {
  let service: CriptomusClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CriptomusClientService],
    }).compile();

    service = module.get<CriptomusClientService>(CriptomusClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
