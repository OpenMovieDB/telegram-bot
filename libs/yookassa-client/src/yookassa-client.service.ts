import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ICreatePayment, YooCheckout } from '@a2seven/yoo-checkout';
import { IReceipt } from '@a2seven/yoo-checkout/build/types/IReceipt';
import { Payment } from '@a2seven/yoo-checkout/build/models';

@Injectable()
export class YookassaClient {
  private readonly token: string;
  private readonly shopId: string;
  private readonly successURL: string;

  private readonly yooKassa: YooCheckout;
  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get('YOOKASSA_SECRET');
    this.shopId = this.configService.get('YOOKASSA_SHOP_ID');
    this.successURL = this.configService.get('BOT_URL');

    this.yooKassa = new YooCheckout({ shopId: this.shopId, secretKey: this.token });
  }

  async createPayment(
    sum: number,
    quantity: number,
    orderId: string,
    email: string,
    comment: string,
  ): Promise<Payment> {
    const amount = (sum * quantity).toFixed(2);

    const createPayload: ICreatePayment = {
      amount: {
        value: amount,
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: this.successURL,
      },
      description: `Заказ ${orderId}`,
      metadata: {
        order_id: orderId,
      },
      receipt: {
        customer: {
          email,
        },
        items: [
          {
            description: comment,
            quantity: quantity.toString(),
            amount: {
              value: sum.toFixed(2),
              currency: 'RUB',
            },
            vat_code: 1,
          },
        ],
      },
    };

    return await this.yooKassa.createPayment(createPayload, orderId);
  }

  async getPaymentInfo(paymentId: string): Promise<Payment> {
    return await this.yooKassa.getPayment(paymentId);
  }
}
