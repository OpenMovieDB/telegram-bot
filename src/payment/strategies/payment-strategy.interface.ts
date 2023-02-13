import { Payment } from '../schemas/payment.schema';

export interface PaymentStrategy {
  createPayment(userId: number, chatId: number, tariffId: string, paymentMonths: number): Promise<Payment>;
  validateTransaction(paymentId: string): Promise<boolean>;
}
