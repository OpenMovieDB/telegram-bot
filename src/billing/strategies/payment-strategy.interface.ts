import { Payment } from '../schemas/payment.schema';

export interface PaymentStrategy {
  createPayment(userId: number, chatId: number, tariffId: string, paymentMonths: number): Promise<Payment>;
  validateTransaction(transactionId: string): Promise<boolean>;
}
