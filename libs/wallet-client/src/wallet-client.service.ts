import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateOrderRequest, CreateOrderResponse, CurrencyCodeEnum, WalletPay } from 'wallet-pay';

@Injectable()
export class WalletClient {
  private walletPay: WalletPay;
  private readonly TIMEOUT = 6000;
  constructor(private readonly configService: ConfigService) {
    this.walletPay = new WalletPay(this.configService.get('WALLET_API_KEY'));
  }

  async createPayment(
    price: number,
    quantity: number,
    orderId: string,
    userId: number,
    comment: string,
  ): Promise<CreateOrderResponse> {
    const amount = (price * quantity).toFixed(2);

    const payload: CreateOrderRequest = {
      amount: {
        currencyCode: CurrencyCodeEnum.RUB,
        amount: amount,
      },
      description: comment,
      externalId: orderId,
      timeoutSeconds: this.TIMEOUT,
      customerTelegramUserId: userId,
    };
    return await this.walletPay.createOrder(payload);
  }

  async getPaymentInfo(walletPaymentId: string): Promise<CreateOrderResponse> {
    return await this.walletPay.getOrderPreview(walletPaymentId.toString());
  }
}
