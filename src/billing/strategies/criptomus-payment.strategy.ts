import { BillingService } from '../billing.service';
import { CriptomusClient } from '@app/criptomus-client';
import { DateTime } from 'luxon';
import { Injectable } from '@nestjs/common';
import { Payment } from '../schemas/payment.schema';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentStrategy } from './payment-strategy.interface';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';
import mongoose from 'mongoose';

@Injectable()
export class CriptomusPaymentStrategy implements PaymentStrategy {
  constructor(
    private readonly billingService: BillingService,
    private readonly tariffService: TariffService,
    private readonly userService: UserService,
    private readonly criptomusClient: CriptomusClient,
  ) {}

  async createPayment(userId: number, chatId: number, tariffId: string, paymentMonths: number): Promise<Payment> {
    const tariff = await this.tariffService.getOneById(tariffId);
    if (!tariff) throw new Error(`Tariff with id ${tariffId} not found`);

    const paymentAmount = tariff.price * paymentMonths;
    const createPaymentResponse = await this.criptomusClient.createPayment(paymentAmount, `User #${userId} payment`);

    return Payment.createPayment(
      userId,
      chatId,
      tariffId,
      tariff.price,
      PaymentSystemEnum.CYPTOMUS,
      paymentAmount,
      createPaymentResponse,
      paymentMonths,
    );
  }

  async validateTransaction(paymentId: string): Promise<boolean> {
    const transaction = await this.criptomusClient.checkPaymentStatus(paymentId);
    const payment = await this.billingService.findPaymentById(paymentId);
    const paymentStatus = transaction.result.payment_status;

    if (paymentStatus === 'paid') {
      const startAt = DateTime.local();
      const expiredAt = startAt.plus({ months: payment.monthCount });

      const user = await this.userService.findOneByUserId(payment.userId);

      if (user) {
        await this.userService.update(user.userId, {
          tariffId: new mongoose.Types.ObjectId(payment.tariffId),
          subscriptionStartDate: startAt.toJSDate(),
          subscriptionEndDate: expiredAt.toJSDate(),
        });
      }

      await this.billingService.updatePaymentStatus(paymentId, PaymentStatusEnum.PAID, true);

      return true;
    }

    return false;
  }
}
