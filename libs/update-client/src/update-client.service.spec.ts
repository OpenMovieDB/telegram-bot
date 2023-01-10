import { Test, TestingModule } from '@nestjs/testing';
import { UpdateClientService } from './update-client.service';

describe('UpdateClientService', () => {
  let service: UpdateClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdateClientService],
    }).compile();

    service = module.get<UpdateClientService>(UpdateClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
