import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { Payment } from '../schemas/payment.schema';

export type CreatePaymentData = {
  userId: number;
  chatId: number;
  tariffId: string;
  tariffPrice: number;
  paymentMonths: number;
  email?: string;
  paymentAt?: Date;
  limit?: number;
};
export interface PaymentStrategy {
  createPayment(data: CreatePaymentData): Promise<Payment>;
  validateTransaction(paymentId: string): Promise<PaymentStatusEnum>;
}
