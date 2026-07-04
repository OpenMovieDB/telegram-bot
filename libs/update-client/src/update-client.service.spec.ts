import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { UpdateClientService } from './update-client.service';

describe('UpdateClientService', () => {
  let service: UpdateClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateClientService,
        {
          provide: HttpService,
          useValue: { put: jest.fn(), patch: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UpdateClientService>(UpdateClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
