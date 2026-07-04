import {
  tariffLine,
  tariffButtons,
  requestsLimitLabel,
  priceLabel,
  adminTariffButtonLabel,
  accountTariffName,
} from './tariff-display.util';
import { BillingTariff } from '../billing/billing.client';

const tariff = (over: Partial<BillingTariff>): BillingTariff => ({
  id: '00000000-0000-0000-0000-000000000001',
  code: 'BASIC',
  display_name: 'Базовый',
  description: '',
  requests_limit: 1000,
  is_default: false,
  is_hidden: false,
  is_popular: false,
  features: [],
  sort_order: 0,
  status: 'active',
  version: 1,
  prices: [{ id: 'p1', months: 1, price_kopecks: 29900, discount_kopecks: 0, currency: 'RUB' }],
  ...over,
});

describe('tariff-display.util', () => {
  // The old enum-based mapping crashed on any catalog code without a matching
  // CommandEnum entry (e.g. PRO). The builders must work for ARBITRARY codes.
  it('builds lines and buttons for catalog codes unknown to the bot', () => {
    const pro = tariff({ code: 'PRO', display_name: 'Профессиональный', requests_limit: 5000 });
    expect(tariffLine(pro)).toContain('Профессиональный');
    expect(tariffLine(pro)).toContain('5000');

    const rows = tariffButtons([pro, tariff({})]);
    const buttons = rows.flat();
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Профессиональный');
    expect(buttons[0].callback_data).toBe(`tariff_${pro.id}`);
  });

  it('marks popular tariffs with ⭐ in lines and buttons', () => {
    const popular = tariff({ is_popular: true });
    expect(tariffLine(popular)).toContain('⭐ Базовый');
    expect(tariffButtons([popular]).flat()[0].text).toBe('⭐ Базовый');
  });

  it('renders the catalog description when present', () => {
    expect(tariffLine(tariff({ description: 'Для пет-проектов' }))).toContain('Для пет-проектов');
    expect(tariffLine(tariff({ description: '' }))).not.toContain('<i></i>');
  });

  it('renders a free tariff as "Всегда бесплатно"', () => {
    expect(tariffLine(tariff({ display_name: 'Демо', is_default: true, prices: [] }))).toContain('Всегда бесплатно');
  });

  it('prices a tariff sold only in long periods as "от …"', () => {
    const yearly = tariff({
      prices: [{ id: 'p12', months: 12, price_kopecks: 358800, discount_kopecks: 0, currency: 'RUB' }],
    });
    expect(priceLabel(yearly)).toBe('от 3588 руб. за 12 мес.');
  });

  it('admin button label carries 🔒 for hidden tariffs', () => {
    expect(adminTariffButtonLabel(tariff({ is_hidden: true }))).toContain('🔒');
    expect(adminTariffButtonLabel(tariff({}))).not.toContain('🔒');
  });

  it('accountTariffName prefers display_name over the code', () => {
    expect(accountTariffName({ id: 't', name: 'BASIC', display_name: 'Базовый', requests_limit: 1000 })).toBe(
      'Базовый',
    );
    expect(accountTariffName({ id: 't', name: 'BASIC', requests_limit: 1000 })).toBe('BASIC');
    expect(accountTariffName(undefined)).toBe('—');
  });

  it('renders huge limits as ∞', () => {
    expect(requestsLimitLabel(tariff({ requests_limit: 99999999999 }))).toBe('∞');
    expect(requestsLimitLabel(tariff({ requests_limit: 1000 }))).toBe('1000');
  });
});
