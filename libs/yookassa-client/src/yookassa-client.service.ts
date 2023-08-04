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

  async generatePayment(amount: number, paymentId: string, comment: string, receipt: IReceipt): Promise<Payment> {
    const checkout = new YooCheckout({ shopId: this.shopId, secretKey: this.token });

    const createPayload: ICreatePayment = {
      amount: {
        value: amount.toString(),
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: this.successURL,
      },
      receipt,
      description: comment,
    };

    return await checkout.createPayment(createPayload, paymentId);
  }
}
