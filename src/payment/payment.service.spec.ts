import { PaymentService } from './payment.service';

// createInvoice records the invoice on the payer (by API token) or, without a
// token, on the admin who issues it — billing requires an account on every
// payment while the invoice itself is not tied to any token.
describe('PaymentService.createInvoice', () => {
  const invoice = { payment_id: 'p-1', external_id: 'ext-1', payment_url: 'https://pay.tbank.ru/x' };
  let billingClient: { createAdminInvoice: jest.Mock };
  let accountClient: { getByToken: jest.Mock; getByTelegramId: jest.Mock };
  let service: PaymentService;

  beforeEach(() => {
    billingClient = { createAdminInvoice: jest.fn().mockResolvedValue(invoice) };
    accountClient = {
      getByToken: jest.fn().mockResolvedValue({ user_id: 'payer-id' }),
      getByTelegramId: jest.fn().mockResolvedValue({ id: 'admin-id' }),
    };
    service = new PaymentService({} as never, billingClient as never, accountClient as never);
  });

  it('records the invoice on the token owner', async () => {
    const result = await service.createInvoice({ token: 'API-KEY' }, 1000, 'Консультация', 'a@b.c');

    expect(accountClient.getByToken).toHaveBeenCalledWith('API-KEY');
    expect(billingClient.createAdminInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'payer-id', amount: 1000, payment_provider: 'tbank', email: 'a@b.c' }),
    );
    expect(result).toEqual({ paymentUrl: 'https://pay.tbank.ru/x', orderId: 'ext-1' });
  });

  it('records the invoice on the issuing admin when no token is given', async () => {
    await service.createInvoice({ adminTelegramId: 42 }, 1000, 'Консультация', 'a@b.c');

    expect(accountClient.getByTelegramId).toHaveBeenCalledWith(42);
    expect(accountClient.getByToken).not.toHaveBeenCalled();
    expect(billingClient.createAdminInvoice).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'admin-id' }));
  });

  it('fails with USER_NOT_FOUND when the token resolves to nobody', async () => {
    accountClient.getByToken.mockResolvedValue(null);

    await expect(service.createInvoice({ token: 'BAD' }, 1000, 'x', 'a@b.c')).rejects.toThrow('USER_NOT_FOUND');
    expect(billingClient.createAdminInvoice).not.toHaveBeenCalled();
  });
});
