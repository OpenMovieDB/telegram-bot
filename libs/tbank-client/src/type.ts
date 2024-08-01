export interface InitPaymentPayload {
  TerminalKey: string;
  Amount: number;
  OrderId: string;
  Description: string;
  Receipt: Receipt;
  DATA: {
    Email: string;
  };
  Token?: string;
}

export interface PaymentItem {
  Name: string;
  Price: number;
  Quantity: number;
  Amount: number;
  Tax: string;
  PaymentObject: string;
}

export interface Receipt {
  Email: string;
  Items: PaymentItem[];
  Taxation: string;
}

export interface CheckPaymentPayload {
  TerminalKey: string;
  PaymentId: string;
  Token?: string;
}

export interface PaymentResponse {
  Success: boolean;
  ErrorCode: string;
  TerminalKey: string;
  Status: string;
  PaymentId: string;
  OrderId: string;
  Amount: number;
  PaymentURL?: string;
  Message?: string;
}
