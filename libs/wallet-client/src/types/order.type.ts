import { Response } from './response.type';

type Status = 'ACTIVE' | 'EXPIRED' | 'PAID' | 'CANCELLED';

export type Amount = {
  currencyCode: string;
  amount: string;
};

export type Order = {
  id: number;
  status: string;
  number: string;
  amount: Amount;
  createdDateTime: string;
  expirationDateTime: string;
  completedDateTime: string;
  payLink: string;
  directPayLink: string;
};
