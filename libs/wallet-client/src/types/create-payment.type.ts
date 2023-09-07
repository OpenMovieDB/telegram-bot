import { Response } from './response.type';
import { Amount, Order } from './order.type';
export type CreatePaymentRquest = {
  amount: Amount;
  description: string;
  returnUrl?: string;
  failReturnUrl?: string;
  customData?: string;
  externalId: string;
  timeoutSeconds: number;
  customerTelegramUserId: number;
};

export type PaymentResponse = Response<Order>;
