import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { CheckPaymentPayload, InitPaymentPayload, PaymentResponse } from '@app/tbank-client/type';

@Injectable()
export class TBankClient {
  private readonly logger = new Logger(TBankClient.name);
  private readonly terminalKey: string;
  private readonly password: string;
  private readonly httpService: HttpService;

  constructor(private readonly configService: ConfigService, httpService: HttpService) {
    this.terminalKey = this.configService.get<string>('TINKOFF_TERMINAL_KEY');
    this.password = this.configService.get<string>('TINKOFF_PASSWORD');
    this.httpService = httpService;
  }

  private generateToken(payload: { [key: string]: any }): string {
    payload.Password = this.password;
    payload.TerminalKey = this.terminalKey;

    const keys = Object.keys(payload)
      .filter((key) => key !== 'Token')
      .sort();

    const values = keys.map((key) => payload[key]);

    const concatenatedString = values.join('');

    return crypto.createHash('sha256').update(concatenatedString).digest('hex');
  }

  async createPayment(
    orderId: string,
    amount: number,
    description: string,
    email: string,
    item: { name: string; price: number; quantity: number; tax: string },
  ): Promise<PaymentResponse> {
    const payload: InitPaymentPayload = {
      TerminalKey: this.terminalKey,
      Amount: amount * 100,
      OrderId: orderId,
      Description: description,
      DATA: { Email: email },
      Receipt: {
        Email: email,
        Taxation: 'usn_income',
        Items: [
          {
            Name: item.name,
            Price: item.price * 100,
            Quantity: item.quantity,
            Amount: amount * 100,
            Tax: 'none',
            PaymentObject: 'service',
          },
        ],
      },
    };

    const tokenPayload: { [key: string]: any } = {
      TerminalKey: payload.TerminalKey,
      Amount: payload.Amount,
      OrderId: payload.OrderId,
      Description: payload.Description,
    };

    payload.Token = this.generateToken(tokenPayload);

    const { data } = await lastValueFrom(
      this.httpService.post<PaymentResponse>('/Init', payload, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 15000,
      }),
    );

    return data;
  }
  async getPaymentInfo(paymentId: string): Promise<PaymentResponse> {
    const payload: CheckPaymentPayload = {
      TerminalKey: this.terminalKey,
      PaymentId: paymentId,
    };

    payload.Token = this.generateToken(payload);

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data } = await lastValueFrom(
          this.httpService.post<PaymentResponse>('/GetState', payload, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            timeout: 15000,
          }),
        );

        this.logger.debug(
          `TBank GetState response for payment ${paymentId}: Status=${data.Status}, Success=${data.Success}, ErrorCode=${data.ErrorCode}`,
        );

        if (data.ErrorCode && data.ErrorCode !== '0') {
          this.logger.warn(
            `TBank GetState error for payment ${paymentId}: ErrorCode=${data.ErrorCode}, Message=${data.Message}`,
          );
        }

        return data;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `TBank GetState attempt ${attempt}/${maxRetries} failed for payment ${paymentId}: ${error.message}`,
        );
        
        if (attempt < maxRetries) {
          // Wait before retry: 1s, 2s, 3s
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }
    
    this.logger.error(
      `Failed to get TBank payment info for ${paymentId} after ${maxRetries} attempts: ${lastError.message}`, 
      lastError.stack
    );
    throw lastError;
  }
}
