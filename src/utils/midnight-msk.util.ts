export function getNextMidnightMSKTimestamp(): number {
  const MSK_OFFSET = 3 * 3600;
  const nowUTC = Math.floor(Date.now() / 1000);
  const nowMSK = nowUTC + MSK_OFFSET;
  const todayMidnightMSK = nowMSK - (nowMSK % 86400);
  const nextMidnightMSK = todayMidnightMSK + 86400;
  return nextMidnightMSK - MSK_OFFSET;
}
