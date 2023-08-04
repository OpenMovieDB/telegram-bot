import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ICreatePayment, YooCheckout } from '@a2seven/yoo-checkout';
import { IReceipt } from '@a2seven/yoo-checkout/build/types/IReceipt';
import { Payment } from '@a2seven/yoo-checkout/build/models';

@Injectable()
export class YookassaClientService {
  private readonly token: string;
  private readonly shopId: string;
  private readonly successURL: string;

  private readonly yooKassa: YooCheckout;
  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get('YOOKASSA_SECRET');
    this.shopId = this.configService.get('YOOKASSA_SHOP_ID');
    this.successURL = this.configService.get('DOMAIN') + '/payment/yookassa/success';

    this.yooKassa = new YooCheckout({ shopId: this.shopId, secretKey: this.token });
  }

  async createPayment(
    sum: number,
    quantity: number,
    paymentId: string,
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
      description: `Заказ ${paymentId}`,
      metadata: {
        order_id: paymentId,
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
              value: amount.toString(),
              currency: 'RUB',
            },
            vat_code: 1,
          },
        ],
      },
    };

    return await this.yooKassa.createPayment(createPayload, paymentId);
  }

  async checkPaymentStatus(paymentId: string): Promise<Payment> {
    return await this.yooKassa.getPayment(paymentId);
  }
}
