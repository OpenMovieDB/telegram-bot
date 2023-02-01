import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CriptomusClientService {
  private readonly apiKey: string;
  private readonly merchantId: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get('CRIPTOMUS_API_KEY');
    this.merchantId = this.configService.get('CRIPTOMUS_MERCHANT_ID');
  }
}
