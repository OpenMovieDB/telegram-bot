import { Body, Controller, Get, Header, Param, Post, Res } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { log } from 'console';
import { YooMoneyClient } from '@app/yoomoney-client';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { YooMoneyNotification } from '@app/update-client/types/notification.type';

@Controller('/payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly yooMoney: YooMoneyClient,
    private readonly configService: ConfigService,
  ) {}

  @Get('yoomoney/success')
  success(@Res() res: any) {
    return { data: 'success' };
  }

  @Post('/yoomoney/notification')
  async yooMoneyWebHook(@Body() body: YooMoneyNotification) {
    const isValid = await this.paymentService.yooMoneyWebHook(body);

    if (isValid) {
      return { data: 'success' };
    } else {
      return { data: 'invalid' };
    }
  }

  @Get(':paymentId')
  @Header('content-type', 'text/html')
  async getPayment(@Param('paymentId') paymentId: string): Promise<string> {
    return this.paymentService.getPaymentForm(paymentId);
  }
}
