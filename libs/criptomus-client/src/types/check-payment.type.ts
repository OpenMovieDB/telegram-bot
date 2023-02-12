import { Payment } from './payment.type';
import { ResponseResult } from './response-result.type';

export type CheckPaymentPayload = {
  uuid: string;
};

export type CheckPaymentResponse = ResponseResult<Payment>;
