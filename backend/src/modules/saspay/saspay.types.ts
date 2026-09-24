/**
 * Types reflétant l'API SasPay documentée sur
 * https://docs.saspay.me — voir /api-reference/introduction et
 * /api-reference/payments.
 */

export type SaspayTransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface SaspaySoftpayRequest {
  amount: string; // decimal en string, ex "2500.00"
  currency: string; // ISO 3 lettres, ex "XOF"
  country: string; // ISO 2 lettres, ex "BF"
  description?: string;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  network: string; // ex "orange_bf", "moov_bf"
  metadata?: Record<string, unknown>;
  fee_charge_mode?: 'ADD_ON' | 'DEDUCTED';
  preferred_gateway?: string;
}

export interface SaspaySoftpayResponse {
  message: string;
  id: string;
  status: SaspayTransactionStatus;
  checkout_url: string;
}

export interface SaspayCheckoutCreateRequest {
  amount: string;
  currency: string;
  description?: string;
  country?: string;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  return_url?: string;
  metadata?: Record<string, unknown>;
  expires_at?: string;
}

/** Données de la session renvoyées sous la propriété `data` par POST /checkout-sessions/. */
export interface SaspayCheckoutSession {
  id: string;
  merchant?: string;
  created_by_member?: string | null;
  slug?: string;
  checkout_url: string;
  amount: string;
  currency: string;
  description?: string;
  country?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  return_url?: string;
  metadata?: Record<string, unknown>;
  status: SaspayTransactionStatus;
  expires_at?: string | null;
  transaction?: string | null;
  payment_link?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Enveloppe réellement renvoyée par la création de checkout observée en production. */
export interface SaspayCheckoutSessionResponse {
  success: true;
  data: SaspayCheckoutSession;
  code: number;
}

export interface SaspayTransaction {
  id: string;
  reference: string;
  merchant: string;
  customer: string;
  country: string;
  network: string;
  transaction_type: 'PAIEMENT' | 'RECHARGE' | 'RETRAIT' | 'TRANSFERT';
  flow_direction: 'INBOUND' | 'OUTBOUND';
  description?: string;
  requested_amount: string;
  fee_charge_mode: 'ADD_ON' | 'DEDUCTED';
  client_fee: string;
  gateway_fee: string;
  platform_fee: string;
  debited_amount: string;
  net_amount: string;
  currency: string;
  status: SaspayTransactionStatus;
  current_gateway?: string;
  external_reference?: string;
  ip_address?: string;
  created_at: string;
  updated_at: string;
}

export interface SaspayErrorBody {
  message: string;
  code: string;
}

/** Enveloppe d'un événement webhook Saspay (transaction.success, etc.) */
export interface SaspayWebhookEnvelope {
  event:
    | 'transaction.created'
    | 'transaction.success'
    | 'transaction.failed'
    | 'transaction.cancelled'
    | 'settlement.requested'
    | 'settlement.approved'
    | 'settlement.success'
    | 'settlement.failed'
    | 'settlement.cancelled'
    | 'wallet_transfer.requested'
    | 'wallet_transfer.completed'
    | 'wallet_transfer.rejected'
    | 'webhook.test';
  data: {
    id?: string;
    reference?: string;
    type?: string;
    status?: SaspayTransactionStatus | string;
    amount?: string;
    fee?: string;
    charged?: string;
    net_amount?: string;
    fee_charge_mode?: 'ADD_ON' | 'DEDUCTED';
    currency?: string;
    country?: string;
    network?: string;
    msisdn?: string;
    /** Peut lier une transaction à la session interne lors d'un checkout hébergé. */
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
}
