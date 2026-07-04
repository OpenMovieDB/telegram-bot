import { Markup } from 'telegraf';
import { BillingTariff } from '../billing/billing.client';
import { AccountTariffDto } from '../account/dto/account-response.dto';
import { isFreeTariff, offeredPeriods } from '../tariff/tariff.service';
import { splitArrayIntoPairs } from './split-array-into-pairs';

// The catalog marks "unlimited" with a huge requests_limit; anything above the
// threshold renders as ∞.
const UNLIMITED_THRESHOLD = 99999999990;

export function requestsLimitLabel(tariff: BillingTariff): string {
  return tariff.requests_limit > UNLIMITED_THRESHOLD ? '∞' : String(tariff.requests_limit);
}

// Popularity is a catalog flag the admin toggles — the bot only renders it.
export function tariffTitle(tariff: BillingTariff): string {
  return `${tariff.is_popular ? '⭐ ' : ''}${tariff.display_name}`;
}

// Price label that works for ANY price configuration: free, monthly, or a
// tariff offered only in longer periods (no months=1 row).
export function priceLabel(tariff: BillingTariff): string {
  if (isFreeTariff(tariff)) return 'Всегда бесплатно';
  const periods = offeredPeriods(tariff);
  if (!periods.length) return 'Всегда бесплатно';
  const monthly = periods.find((period) => period.months === 1);
  if (monthly) return `${monthly.priceRub} руб./месяц`;
  return `от ${periods[0].priceRub} руб. за ${periods[0].months} мес.`;
}

export function tariffLine(tariff: BillingTariff): string {
  const description = tariff.description ? `<i>${tariff.description}</i>\n` : '';
  return (
    `<b>${tariffTitle(tariff)}</b>: <i>${requestsLimitLabel(tariff)}</i> запросов в сутки. ` +
    `<b>${priceLabel(tariff)}</b>.\n${description}`
  );
}

// Buttons are built straight from the billing catalog (`tariff_<id>`), so a
// new tariff in billing shows up here without any bot-side enum/scene work.
export function tariffButtons(tariffs: BillingTariff[]) {
  return splitArrayIntoPairs(
    tariffs.map((tariff) => Markup.button.callback(tariffTitle(tariff), `tariff_${tariff.id}`)),
  );
}

// Compact one-line label for admin tariff pickers; hidden tariffs are visible
// to admins only and carry a 🔒 marker.
export function adminTariffButtonLabel(tariff: BillingTariff): string {
  const hidden = tariff.is_hidden ? '🔒 ' : '';
  return `${hidden}${tariffTitle(tariff)} (${requestsLimitLabel(tariff)} req/day, ${priceLabel(tariff)})`;
}

// The user-facing name of an account's tariff: account-service sends both
// `name` (the catalog code) and `display_name`; codes are for logs only.
export function accountTariffName(tariff?: AccountTariffDto | null): string {
  return tariff?.display_name || tariff?.name || '—';
}
