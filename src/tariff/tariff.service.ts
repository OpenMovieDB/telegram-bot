import { Injectable, Logger } from '@nestjs/common';
import { BillingClient, BillingTariff } from 'src/billing/billing.client';

const CACHE_TTL_MS = 5 * 60 * 1000;

// Display helpers over the billing catalog. Prices live in billing as
// per-period entries in kopecks; the bot only formats them.
export function monthlyPriceRub(tariff: BillingTariff): number {
  const monthly = tariff.prices.find((price) => price.months === 1);
  return monthly ? monthly.price_kopecks / 100 : 0;
}

// billing sells ONLY exact (tariff, months) price rows (PriceFor →
// price_not_available otherwise) — there is no "monthly × N" formula. A period
// without a row is simply not offered.
export function priceForMonthsRub(tariff: BillingTariff, months: number): number | null {
  const exact = tariff.prices.find((price) => price.months === months);
  return exact ? exact.price_kopecks / 100 : null;
}

// The free tariff is a catalog property, not a price heuristic: it is the
// default one every new account gets (and a tariff with no price rows cannot
// be sold either way). A paid tariff offered only in 3/6/12-month periods has
// no months=1 row — price-based checks would misroute it to the free flow.
export function isFreeTariff(tariff: BillingTariff): boolean {
  return tariff.is_default || tariff.prices.length === 0;
}

export function offeredPeriods(tariff: BillingTariff): { months: number; priceRub: number }[] {
  return tariff.prices
    .filter((price) => price.currency === 'RUB')
    .sort((a, b) => a.months - b.months)
    .map((price) => ({ months: price.months, priceRub: price.price_kopecks / 100 }));
}

@Injectable()
export class TariffService {
  private readonly logger = new Logger(TariffService.name);
  private cache: BillingTariff[] = [];
  private cacheAt = 0;
  private inflight: Promise<BillingTariff[]> | null = null;

  constructor(private readonly billing: BillingClient) {}

  private async load(): Promise<BillingTariff[]> {
    if (this.cache.length && Date.now() - this.cacheAt < CACHE_TTL_MS) {
      return this.cache;
    }
    if (this.inflight) return this.inflight;
    this.inflight = this.billing
      .listTariffs()
      .then((tariffs) => {
        this.cache = tariffs;
        this.cacheAt = Date.now();
        return this.cache;
      })
      .catch((err) => {
        this.logger.error(`Failed to load billing tariff catalog: ${(err as Error).message}`);
        throw err;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  // Catalog edits in billing publish billing.tariff.catalog.updated; the
  // events consumer calls this so users see changes immediately. The TTL above
  // stays as a fallback when NATS is down.
  invalidate(): void {
    this.cacheAt = 0;
  }

  async getOneById(id: string): Promise<BillingTariff | null> {
    if (!id) return null;
    const list = await this.load();
    return list.find((tariff) => tariff.id === id) ?? null;
  }

  async getOneByCode(code: string): Promise<BillingTariff | null> {
    const list = await this.load();
    return list.find((tariff) => tariff.code.toUpperCase() === code.toUpperCase()) ?? null;
  }

  // The catalog order is the admin's sort_order (billing returns it sorted) —
  // the bot must not impose its own ordering.
  async getAllTariffs(): Promise<BillingTariff[]> {
    const list = await this.load();
    return list.filter((tariff) => !tariff.is_hidden);
  }

  async getFreeTariff(): Promise<BillingTariff | null> {
    const list = await this.load();
    return list.find((tariff) => tariff.is_default) ?? null;
  }

  // Admin flows see the full catalog including hidden (staff/partner) tariffs;
  // archived ones are never offered. No cache — admin actions are rare and
  // must see fresh data.
  async getAdminTariffs(): Promise<BillingTariff[]> {
    const list = await this.billing.adminListTariffs();
    return list.filter((tariff) => tariff.status === 'active');
  }

  async resolveForAdmin(idOrCode: string): Promise<BillingTariff | null> {
    const list = await this.getAdminTariffs();
    return (
      list.find((tariff) => tariff.id === idOrCode) ??
      list.find((tariff) => tariff.code.toUpperCase() === idOrCode.toUpperCase()) ??
      null
    );
  }
}
