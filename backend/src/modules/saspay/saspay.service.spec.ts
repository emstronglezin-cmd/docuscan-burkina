import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SaspayService } from './saspay.service';

const checkoutSessionData = {
  id: '67d60995-7b7e-4239-a7a4-8c6e764d70fc',
  slug: 'Lz50EMu2PRiD4dxo8e7BqP71MRjQOmRJ',
  checkout_url: 'https://checkout.saspay.me/Lz50EMu2PRiD4dxo8e7BqP71MRjQOmRJ',
  amount: '500.00',
  currency: 'XOF',
  status: 'PENDING',
  return_url: 'https://web-ten-gamma-22.vercel.app/paiement/succes',
  metadata: {
    docuscan_payment_id: '542db37a-ed7a-40b0-8275-22d1ed1b063f',
    user_id: 'fd409a86-8ff0-4df4-b8bc-95841d6a6f03',
  },
};

describe('SaspayService checkout sessions', () => {
  let service: SaspayService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    const saspayConfig = {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.saspay.me/api/v1',
      webhookSigningSecret: 'test-webhook-secret',
      defaultCountry: 'BF',
      defaultCurrency: 'XOF',
      returnUrl: 'https://web-ten-gamma-22.vercel.app/paiement/succes',
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        SaspayService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(saspayConfig) } },
      ],
    }).compile();
    service = moduleRef.get(SaspayService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await moduleRef.close();
  });

  it('unwraps a successful checkout envelope and returns its data', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: checkoutSessionData, code: 201 }), {
        status: 201,
      }),
    );

    const session = await service.createCheckoutSession({
      amount: '500.00',
      currency: 'XOF',
      customer_email: 'client@example.com',
      customer_name: 'Client DocuScan',
      return_url: 'https://web-ten-gamma-22.vercel.app/paiement/succes',
      metadata: { docuscan_payment_id: '542db37a-ed7a-40b0-8275-22d1ed1b063f' },
    });

    expect(session.id).toBe(checkoutSessionData.id);
    expect(session.checkout_url).toBe(checkoutSessionData.checkout_url);
    expect(session.metadata).toEqual(checkoutSessionData.metadata);
    expect(session).not.toHaveProperty('success');
  });

  it('rejects an HTTP 201 response without data.checkout_url explicitly', async () => {
    const dataWithoutCheckoutUrl = {
      id: checkoutSessionData.id,
      slug: checkoutSessionData.slug,
      amount: checkoutSessionData.amount,
      currency: checkoutSessionData.currency,
      status: checkoutSessionData.status,
      return_url: checkoutSessionData.return_url,
      metadata: checkoutSessionData.metadata,
    };
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: dataWithoutCheckoutUrl, code: 201 }), {
        status: 201,
      }),
    );

    await expect(
      service.createCheckoutSession({
        amount: '500.00',
        currency: 'XOF',
        customer_email: 'client@example.com',
        customer_name: 'Client DocuScan',
      }),
    ).rejects.toThrow('SASPAY checkout session created but data.checkout_url is missing');
  });

  it('rejects an HTTP 201 response without data.id explicitly', async () => {
    const dataWithoutId = {
      slug: checkoutSessionData.slug,
      checkout_url: checkoutSessionData.checkout_url,
      amount: checkoutSessionData.amount,
      currency: checkoutSessionData.currency,
      status: checkoutSessionData.status,
      return_url: checkoutSessionData.return_url,
      metadata: checkoutSessionData.metadata,
    };
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: dataWithoutId, code: 201 }), {
        status: 201,
      }),
    );

    await expect(
      service.createCheckoutSession({
        amount: '500.00',
        currency: 'XOF',
        customer_email: 'client@example.com',
        customer_name: 'Client DocuScan',
      }),
    ).rejects.toThrow('SASPAY checkout session created but data.id is missing');
  });
});
