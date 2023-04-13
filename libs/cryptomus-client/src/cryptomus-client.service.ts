import * as crypto from 'crypto';

import { CheckPaymentPayload, CheckPaymentResponse } from './types/check-payment.type';
import { CratePaymentPayload, CreatePaymentResponse } from './types/create-payment.type';
import { lastValueFrom } from 'rxjs';

import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CryptomusClient {
  private readonly apiKey: string;
  private readonly merchantId: string;

  constructor(private readonly httpService: HttpService, private readonly configService: ConfigService) {
    this.apiKey = this.configService.get('CRYPTOMUS_API_KEY');
    this.merchantId = this.configService.get('CRYPTOMUS_MERCHANT_ID');
  }

  getHeaders(payload: { [key: string]: any }) {
    const payloadString = JSON.stringify(payload);

    const sign = crypto
      .createHash('md5')
      .update(Buffer.from(payloadString).toString('base64') + this.apiKey)
      .digest('hex');

    return {
      merchant: this.merchantId,
      sign,
    };
  }

  async createPayment(amount: number, orderId: string): Promise<CreatePaymentResponse> {
    const payload: CratePaymentPayload = {
      amount: amount.toString(),
      currency: 'RUB',
      order_id: orderId,
    };

    const { data } = await lastValueFrom(
      this.httpService.post('/payment', payload, {
        headers: this.getHeaders(payload),
        timeout: 5000,
      }),
    );
    return data;
  }

  async checkPaymentStatus(paymentId: string): Promise<CheckPaymentResponse> {
    const payload: CheckPaymentPayload = {
      uuid: paymentId,
    };

    const { data } = await lastValueFrom(
      this.httpService.post('/payment/info', payload, {
        headers: this.getHeaders(payload),
      }),
    );

    return data;
  }
}
