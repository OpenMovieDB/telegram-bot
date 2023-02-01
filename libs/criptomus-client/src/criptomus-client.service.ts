import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

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

  getHeaders(payload: { [key: string]: any }) {
    const payloadString = JSON.stringify(payload);
    const sign = crypto
      .createHash('md5')
      .update(Buffer.from(payloadString) + this.apiKey)
      .digest('hex');

    return {
      merchant: this.merchantId,
      sign,
    };
  }
}
