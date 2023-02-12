import { Payment } from './payment.type';
import { ResponseResult } from './response-result.type';

export type CratePaymentPayload = {
  amount: string;
  currency: string;
  order_id: string;
  url_return?: string;
  url_callback?: string;
};

export type CreatePaymentResponse = ResponseResult<Payment>;
