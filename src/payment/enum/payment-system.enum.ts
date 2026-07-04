// Payment channels still offered by the bot. All money flows through
// billing-service: TBANK→tbank, CYPTOMUS→heleket (see payment-provider.map.ts).
// CASH is an operator-recorded sale (billing /v1/admin/payments/cash).
// YooKassa/YooMoney/Wallet are retired (no paid traffic since 2024).
export enum PaymentSystemEnum {
  TBANK = 'TBANK',
  CYPTOMUS = 'CYPTOMUS',
  CASH = 'CASH',
}
