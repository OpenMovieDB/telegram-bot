import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { Payment } from '../schemas/payment.schema';

export interface PaymentStrategy {
  createPayment(data: {
    userId: number;
    chatId: number;
    tariffId: string;
    tariffPrice: number;
    paymentMonths: number;
  }): Promise<Payment>;
  validateTransaction(paymentId: string): Promise<PaymentStatusEnum>;
}
