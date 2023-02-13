import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { CreatePaymentResponse } from '@app/criptomus-client/types/create-payment.type';
import { HydratedDocument } from 'mongoose';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { v4 as uuidv4 } from 'uuid';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema()
export class Payment {
  @Prop()
  paymentId: string;

  @Prop({ default: () => PaymentStatusEnum.PENDING })
  status: string;

  @Prop({ type: String, enum: PaymentSystemEnum })
  paymentSystem: PaymentSystemEnum;

  @Prop()
  userId: number;

  @Prop()
  chatId: number;

  @Prop()
  tariffId: string;

  @Prop()
  amount: number;

  @Prop()
  paymentAmount: number;

  @Prop()
  paymentCurrency: string;

  @Prop()
  description: string;

  @Prop()
  url: string;

  @Prop()
  monthCount: number;

  @Prop()
  transactionId: string;

  @Prop()
  payerAmount: string;

  @Prop()
  payerCurrency: string;

  @Prop()
  network: string;

  @Prop()
  address: string;

  @Prop()
  from: string;

  @Prop()
  txid: string;

  @Prop()
  isFinal: boolean;

  constructor(payment: Partial<Payment>) {
    Object.assign(this, payment);
  }

  static createPayment(
    userId: number,
    chatId: number,
    tariffId: string,
    tariffPrice: number,
    paymentSystem: PaymentSystemEnum,
    paymentAmount: number,
    createPaymentResponse: CreatePaymentResponse,
    paymentMonths: number,
  ): Payment {
    return new Payment({
      userId,
      chatId,
      tariffId,
      amount: tariffPrice,
      paymentSystem,
      paymentAmount,
      paymentCurrency: createPaymentResponse.result.payer_currency,
      description: '',
      url: createPaymentResponse.result.url,
      monthCount: paymentMonths,
      transactionId: createPaymentResponse.result.txid,
      payerAmount: createPaymentResponse.result.payer_amount,
      payerCurrency: createPaymentResponse.result.payer_currency,
      network: createPaymentResponse.result.network,
      address: createPaymentResponse.result.address,
      from: createPaymentResponse.result.from,
      txid: createPaymentResponse.result.txid,
      isFinal: createPaymentResponse.result.is_final,
    });
  }
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
