import { TariffService, isFreeTariff, priceForMonthsRub, offeredPeriods } from './tariff.service';
import { BillingClient, BillingTariff } from '../billing/billing.client';

const tariff = (over: Partial<BillingTariff>): BillingTariff => ({
  id: over.code ?? 'id',
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

describe('tariff catalog helpers', () => {
  it('isFreeTariff is a catalog property, not a price heuristic', () => {
    expect(isFreeTariff(tariff({ is_default: true, prices: [] }))).toBe(true);
    expect(isFreeTariff(tariff({ prices: [] }))).toBe(true);
    // A paid tariff sold only in 3-month periods has no months=1 row — it must
    // NOT be treated as free.
    expect(
      isFreeTariff(
        tariff({ prices: [{ id: 'p3', months: 3, price_kopecks: 89700, discount_kopecks: 0, currency: 'RUB' }] }),
      ),
    ).toBe(false);
  });

  it('priceForMonthsRub sells only exact catalog rows — no monthly × N formula', () => {
    const t = tariff({});
    expect(priceForMonthsRub(t, 1)).toBe(299);
    expect(priceForMonthsRub(t, 2)).toBeNull();
  });

  it('offeredPeriods returns RUB rows sorted by months', () => {
    const t = tariff({
      prices: [
        { id: 'p12', months: 12, price_kopecks: 358800, discount_kopecks: 0, currency: 'RUB' },
        { id: 'p1', months: 1, price_kopecks: 29900, discount_kopecks: 0, currency: 'RUB' },
        { id: 'usd', months: 6, price_kopecks: 1000, discount_kopecks: 0, currency: 'USD' },
      ],
    });
    expect(offeredPeriods(t)).toEqual([
      { months: 1, priceRub: 299 },
      { months: 12, priceRub: 3588 },
    ]);
  });
});

describe('TariffService', () => {
  const catalog = [
    tariff({ code: 'UNLIMITED', sort_order: 30 }),
    tariff({ code: 'DEMO', sort_order: 10, is_default: true, prices: [] }),
    tariff({ code: 'STAFF', sort_order: 20, is_hidden: true }),
  ];

  const makeService = () => {
    const billing = {
      listTariffs: jest.fn().mockResolvedValue(catalog),
      adminListTariffs: jest.fn().mockResolvedValue([...catalog, tariff({ code: 'OLD', status: 'archived' })]),
    } as unknown as BillingClient;
    return { service: new TariffService(billing), billing };
  };

  it('preserves the catalog order (billing sorts by sort_order) and hides hidden tariffs', async () => {
    const { service } = makeService();
    const tariffs = await service.getAllTariffs();
    expect(tariffs.map((t) => t.code)).toEqual(['UNLIMITED', 'DEMO']);
  });

  it('admin catalog includes hidden tariffs but never archived ones', async () => {
    const { service } = makeService();
    const tariffs = await service.getAdminTariffs();
    expect(tariffs.map((t) => t.code)).toEqual(['UNLIMITED', 'DEMO', 'STAFF']);
  });

  it('resolveForAdmin finds hidden tariffs by id and by code', async () => {
    const { service } = makeService();
    expect((await service.resolveForAdmin('staff'))?.code).toBe('STAFF');
    expect((await service.resolveForAdmin('STAFF'))?.code).toBe('STAFF');
    expect(await service.resolveForAdmin('OLD')).toBeNull();
  });

  it('invalidate() drops the cache so the next read refetches', async () => {
    const { service, billing } = makeService();
    await service.getAllTariffs();
    await service.getAllTariffs();
    expect((billing.listTariffs as jest.Mock).mock.calls).toHaveLength(1);
    service.invalidate();
    await service.getAllTariffs();
    expect((billing.listTariffs as jest.Mock).mock.calls).toHaveLength(2);
  });
});
