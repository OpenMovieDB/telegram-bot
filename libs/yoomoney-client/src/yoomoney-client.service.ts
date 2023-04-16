import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  API,
  Operation,
  OperationDetailsParameters,
  OperationHistoryParameters,
  OperationHistoryResponse,
  YMFormPaymentType,
  YMPaymentFromBuilder,
} from 'yoomoney-sdk';

@Injectable()
export class YooMoneyClient {
  private readonly token: string;
  private readonly receiver: string;
  private readonly successURL: string;
  private yooMoney: API;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get('YOOMONEY_API_KEY');
    this.receiver = this.configService.get('YOOMONEY_WALLET');
    this.successURL = this.configService.get('DOMAIN') + '/payment/yoomoney/success';
    this.yooMoney = new API(this.token);
  }

  generatePaymentForm(amount: number, paymentId: string, comment: string): string {
    const builder = new YMPaymentFromBuilder({
      quickPayForm: 'donate',
      sum: amount,
      successURL: this.successURL,
      paymentType: YMFormPaymentType.FromCard,
      receiver: this.receiver,
      label: paymentId,
      formComment: 'Поддержка проекта kinopoisk.dev',
      targets: comment,
    });

    return builder.buildHtml();
  }

  async getOperationDetails(operationId: string): Promise<Operation> {
    const parameters: OperationDetailsParameters = {
      operation_id: operationId,
    };
    return await this.yooMoney.operationDetails(parameters);
  }

  async getOperationHistory(parameters?: OperationHistoryParameters): Promise<OperationHistoryResponse> {
    return this.yooMoney.operationHistory(parameters);
  }
}
