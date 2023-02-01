import { ResponseResult } from './response-result.type';
import { Currency } from './currency.type';

export type CratePaymentPayload = {
  amount: string;
  currency: string;
  order_id: string;
  url_return: string;
  url_callback: string;
};

export type CreatePaymentResult = {
  uuid: string;
  order_id: string;
  amount: string;
  payment_amount: string;
  payer_amount: string;
  payer_currency: string;
  currency: string;
  comments: string;
  network: string;
  address: string;
  from: string;
  txid: string;
  payment_status: string;
  url: string;
  expired_at: number;
  status: string;
  is_final: boolean;
  additional_data: string;
  currencies: Currency[];
};

export type CreatePaymentResponse = ResponseResult<CreatePaymentResult>;
