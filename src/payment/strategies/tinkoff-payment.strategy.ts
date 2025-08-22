import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { Payment } from '../schemas/payment.schema';
import { PaymentStrategy, CreatePaymentData } from './payment-strategy.interface';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { TBankClient } from '@app/tbank-client';

@Injectable()
export class TBankPaymentStrategy implements PaymentStrategy {
  private readonly logger = new Logger(TBankPaymentStrategy.name);

  constructor(private readonly tBankClient: TBankClient, private readonly configService: ConfigService) {}

  async createPayment({ tariffPrice, paymentMonths, ...data }: CreatePaymentData): Promise<Payment> {
    const tariffDescription = data.limit <= 5000 ? 'с ограничением на ' + data.limit : 'без лимита на количество';
    const description = `Доступ к базе данных о кино сроком на ${paymentMonths} м., ${tariffDescription} обращений в сутки.`;

    const orderId = uuidv4();
    const amount = tariffPrice * paymentMonths;
    const productName = `Доступ к базе данных о кино, ${tariffDescription} обращений в сутки.`;

    const createPaymentResponse = await this.tBankClient.createPayment(orderId, amount, description, data.email, {
      name: productName,
      price: tariffPrice,
      quantity: paymentMonths,
      tax: '',
    });

    if (createPaymentResponse.ErrorCode != '0') {
      throw new Error(createPaymentResponse.Message);
    }

    return new Payment({
      ...data,
      orderId,
      paymentId: createPaymentResponse.PaymentId,
      amount: tariffPrice,
      paymentSystem: PaymentSystemEnum.TBANK,
      paymentAmount: Number(createPaymentResponse.Amount),
      paymentCurrency: 'RUB',
      url: createPaymentResponse.PaymentURL,
      monthCount: paymentMonths,
    });
  }

  async validateTransaction(paymentId: string): Promise<PaymentStatusEnum> {
    try {
      const data = await this.tBankClient.getPaymentInfo(paymentId);
      this.logger.debug(
        `TBank payment ${paymentId} status: ${data.Status}, ErrorCode: ${data.ErrorCode}, Success: ${data.Success}`,
      );

      // Map TBank statuses to our PaymentStatusEnum
      switch (data.Status) {
        case 'CONFIRMED':
        case 'AUTHORIZED':
          return PaymentStatusEnum.PAID;
        case 'CANCELED':
        case 'REVERSED':
        case 'REFUNDED':
        case 'PARTIAL_REFUNDED':
          return PaymentStatusEnum.CANCELED;
        case 'REJECTED':
        case 'DEADLINE_EXPIRED':
          return PaymentStatusEnum.FAILED;
        case 'NEW':
        case 'FORM_SHOWED':
        case 'AUTHORIZING':
        case 'CONFIRMING':
        case '3DS_CHECKING':
        case '3DS_CHECKED':
        case 'REVERSING':
        case 'PARTIAL_REVERSING':
        case 'REFUNDING':
        case 'PARTIAL_REFUNDING':
        case 'ASYNC_REFUNDING':
          return PaymentStatusEnum.PENDING;
        default:
          this.logger.warn(`Unknown TBank payment status: ${data.Status} for payment ${paymentId}`);
          return PaymentStatusEnum.PENDING;
      }
    } catch (error) {
      this.logger.error(`Error validating TBank payment ${paymentId}: ${error.message}`, error.stack);
      return PaymentStatusEnum.FAILED;
    }
  }
}
