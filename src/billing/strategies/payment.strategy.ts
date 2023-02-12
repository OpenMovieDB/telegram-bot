import { TariffDocument } from 'src/tariff/schemas/tariff.schema';
import { Payment } from '../schemas/payment.schema';

export interface PaymentStrategy {
  execute(userId: number, chatId: number, tariff: TariffDocument, paymentMonths: number): Promise<Payment | undefined>;
}
