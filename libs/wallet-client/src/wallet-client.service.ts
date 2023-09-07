import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PaymentResponse, CreatePaymentRquest } from '@app/wallet-client/types/create-payment.type';
import { lastValueFrom, map } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WalletClient {
  private WALLET_API_KEY: string;
  private readonly TIMEOUT = 6000;
  constructor(private readonly httpService: HttpService, private readonly configService: ConfigService) {
    this.WALLET_API_KEY = this.configService.get('WALLET_API_KEY');
  }

  async createPayment(
    price: number,
    quantity: number,
    orderId: string,
    userId: number,
    comment: string,
  ): Promise<PaymentResponse> {
    const amount = (price * quantity).toFixed(2);

    const payload: CreatePaymentRquest = {
      amount: {
        currencyCode: 'RUB',
        amount: amount,
      },
      description: comment,
      externalId: orderId,
      timeoutSeconds: this.TIMEOUT,
      customerTelegramUserId: userId,
    };
    return await lastValueFrom(
      this.httpService
        .post('/order', payload, {
          headers: {
            'Wpay-Store-Api-Key': this.WALLET_API_KEY,
          },
        })
        .pipe(map((res) => res.data)),
    );
  }

  async getPaymentInfo(walletPaymentId: number): Promise<PaymentResponse> {
    return await lastValueFrom(
      this.httpService
        .get(`/order/preview`, {
          headers: {
            'Wpay-Store-Api-Key': this.WALLET_API_KEY,
          },
          params: {
            id: walletPaymentId,
          },
        })
        .pipe(map((res) => res.data)),
    );
  }
}
