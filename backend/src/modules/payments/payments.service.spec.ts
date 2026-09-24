import { BadGatewayException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { CreditPack } from '../credit-packs/entities/credit-pack.entity';
import { CreditPacksService } from '../credit-packs/credit-packs.service';
import { CreditsService } from '../credits/credits.service';
import {
  SaspayCheckoutCreateRequest,
  SaspayCheckoutSession,
  SaspayWebhookEnvelope,
} from '../saspay/saspay.types';
import { SaspayService } from '../saspay/saspay.service';
import { UsersRepositoryLite } from './users-repository-lite';
import {
  SaspayPayment,
  SaspayPaymentMethod,
  SaspayPaymentStatus,
} from './entities/saspay-payment.entity';
import { PaymentsService } from './payments.service';

const USER_ID = 'fd409a86-8ff0-4df4-b8bc-95841d6a6f03';
const PAYMENT_ID = '542db37a-ed7a-40b0-8275-22d1ed1b063f';
const CHECKOUT_SESSION_ID = '67d60995-7b7e-4239-a7a4-8c6e764d70fc';
const CHECKOUT_URL = 'https://checkout.saspay.me/Lz50EMu2PRiD4dxo8e7BqP71MRjQOmRJ';

function makePack(priceFcfa: number, credits = 1): CreditPack {
  return {
    id: `pack-${priceFcfa}`,
    name: `${credits} crédit(s)`,
    credits,
    priceFcfa,
    isActive: true,
    sortOrder: 0,
    isPopular: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeSession(amount: number): SaspayCheckoutSession {
  return {
    id: CHECKOUT_SESSION_ID,
    slug: 'Lz50EMu2PRiD4dxo8e7BqP71MRjQOmRJ',
    checkout_url: CHECKOUT_URL,
    amount: amount.toFixed(2),
    currency: 'XOF',
    status: 'PENDING',
    return_url: 'https://web-ten-gamma-22.vercel.app/paiement/succes',
    metadata: { docuscan_payment_id: PAYMENT_ID, user_id: USER_ID },
  };
}

function makeWebhook(): SaspayWebhookEnvelope {
  return {
    event: 'transaction.success',
    data: {
      id: 'saspay-transaction-id',
      reference: 'TXN-20260924-000001',
      status: 'SUCCESS',
      metadata: { docuscan_payment_id: PAYMENT_ID, user_id: USER_ID },
    },
  };
}

describe('PaymentsService checkout and Saspay webhooks', () => {
  let paymentsService: PaymentsService;
  let moduleRef: TestingModule;
  let createdPayments: SaspayPayment[];

  const paymentRepoMock = {
    create: jest.fn<(values: Partial<SaspayPayment>) => SaspayPayment>(),
    save: jest.fn<(payment: SaspayPayment) => Promise<SaspayPayment>>(),
    findOne: jest.fn<() => Promise<SaspayPayment | null>>(),
    find: jest.fn<() => Promise<SaspayPayment[]>>(),
  };
  const saspayServiceMock = {
    getValidatedReturnUrl: jest.fn<() => string>(),
    createCheckoutSession:
      jest.fn<(payload: SaspayCheckoutCreateRequest) => Promise<SaspayCheckoutSession>>(),
    getCheckoutSession: jest.fn(),
    verifyPayment: jest.fn(),
    initiateSoftpay: jest.fn(),
    defaultCurrency: 'XOF',
    defaultCountry: 'BF',
  };
  const creditPacksServiceMock = {
    findOne: jest.fn<() => Promise<CreditPack>>(),
  };
  const creditsServiceMock = { creditForPurchase: jest.fn<() => Promise<void>>() };
  const usersRepoMock = {
    findById: jest.fn<() => Promise<{ id: string; email: string; fullName: string } | null>>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    createdPayments = [];

    paymentRepoMock.create.mockImplementation((values: Partial<SaspayPayment>) => {
      const payment = Object.assign(new SaspayPayment(), values, { id: PAYMENT_ID });
      createdPayments.push(payment);
      return payment;
    });
    paymentRepoMock.save.mockImplementation(async (payment: SaspayPayment) => payment);
    paymentRepoMock.findOne.mockResolvedValue(null);
    paymentRepoMock.find.mockResolvedValue([]);

    saspayServiceMock.getValidatedReturnUrl.mockReturnValue(
      'https://web-ten-gamma-22.vercel.app/paiement/succes',
    );
    saspayServiceMock.createCheckoutSession.mockImplementation(async (payload) =>
      makeSession(Number(payload.amount)),
    );

    creditPacksServiceMock.findOne.mockResolvedValue(makePack(500, 10));
    creditsServiceMock.creditForPurchase.mockResolvedValue(undefined);
    usersRepoMock.findById.mockResolvedValue({
      id: USER_ID,
      email: 'client@example.com',
      fullName: 'Client DocuScan',
    });

    moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(SaspayPayment), useValue: paymentRepoMock },
        { provide: SaspayService, useValue: saspayServiceMock },
        { provide: CreditPacksService, useValue: creditPacksServiceMock },
        { provide: CreditsService, useValue: creditsServiceMock },
        { provide: UsersRepositoryLite, useValue: usersRepoMock },
      ],
    }).compile();

    paymentsService = moduleRef.get(PaymentsService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('persists the SASPAY session reference and URL and returns the frontend checkout payload', async () => {
    const payment = await paymentsService.initiateCheckout(USER_ID, {
      creditPackId: 'pack-500',
    });

    expect(createdPayments).toHaveLength(1);
    expect(payment.id).toBe(PAYMENT_ID);
    expect(payment.saspayReference).toBe(CHECKOUT_SESSION_ID);
    expect(payment.checkoutUrl).toBe(CHECKOUT_URL);
    expect(payment.status).toBe(SaspayPaymentStatus.PENDING);
    expect(saspayServiceMock.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '500.00',
        currency: 'XOF',
        metadata: { docuscan_payment_id: PAYMENT_ID, user_id: USER_ID },
      }),
    );
    expect(paymentRepoMock.save).toHaveBeenCalledTimes(2);
  });

  it.each([250, 500])('creates and maps a checkout session for a %i XOF pack', async (amount) => {
    creditPacksServiceMock.findOne.mockResolvedValue(makePack(amount, amount / 50));

    const payment = await paymentsService.initiateCheckout(USER_ID, {
      creditPackId: `pack-${amount}`,
    });

    expect(saspayServiceMock.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amount: `${amount}.00`, currency: 'XOF' }),
    );
    expect(payment.saspayReference).toBe(CHECKOUT_SESSION_ID);
    expect(payment.checkoutUrl).toBe(CHECKOUT_URL);
  });

  it('rejects a 50 XOF pack before saving a payment or calling SASPAY', async () => {
    creditPacksServiceMock.findOne.mockResolvedValue(makePack(50, 1));

    await expect(
      paymentsService.initiateCheckout(USER_ID, { creditPackId: 'pack-50' }),
    ).rejects.toThrow(
      'Ce pack coûte 50 XOF. Le montant minimum accepté par SASPAY est de 200 XOF.',
    );

    expect(saspayServiceMock.createCheckoutSession).not.toHaveBeenCalled();
    expect(paymentRepoMock.create).not.toHaveBeenCalled();
    expect(paymentRepoMock.save).not.toHaveBeenCalled();
  });

  it('marks the local payment failed when SASPAY cannot provide a redirect-ready session', async () => {
    const error = new BadGatewayException(
      'SASPAY checkout session created but data.checkout_url is missing',
    );
    saspayServiceMock.createCheckoutSession.mockRejectedValue(error);

    await expect(
      paymentsService.initiateCheckout(USER_ID, { creditPackId: 'pack-500' }),
    ).rejects.toBe(error);

    expect(createdPayments).toHaveLength(1);
    expect(createdPayments[0].status).toBe(SaspayPaymentStatus.FAILED);
    expect(createdPayments[0].checkoutUrl).toBeUndefined();
    expect(createdPayments[0].saspayReference).toBeUndefined();
  });

  it('credits a checkout payment only on a successful webhook, using internal metadata when transaction and session IDs differ', async () => {
    const payment = Object.assign(new SaspayPayment(), {
      id: PAYMENT_ID,
      userId: USER_ID,
      creditPackId: 'pack-500',
      creditsRequested: 10,
      amountFcfa: 500,
      method: SaspayPaymentMethod.CHECKOUT,
      saspayReference: CHECKOUT_SESSION_ID,
      status: SaspayPaymentStatus.PENDING,
      creditsApplied: false,
    });
    paymentRepoMock.findOne
      .mockResolvedValueOnce(payment) // metadata -> internal payment ID
      .mockResolvedValueOnce(null); // webhook transaction ID is not the session ID

    const event = makeWebhook();
    await paymentsService.handleWebhookEvent({ ...event, event: 'transaction.created' });
    expect(creditsServiceMock.creditForPurchase).not.toHaveBeenCalled();

    paymentRepoMock.findOne.mockResolvedValueOnce(payment).mockResolvedValueOnce(null);
    await paymentsService.handleWebhookEvent(event);

    expect(payment.status).toBe(SaspayPaymentStatus.SUCCESS);
    expect(payment.creditsApplied).toBe(true);
    expect(creditsServiceMock.creditForPurchase).toHaveBeenCalledTimes(1);
    expect(creditsServiceMock.creditForPurchase).toHaveBeenCalledWith(
      USER_ID,
      10,
      CHECKOUT_SESSION_ID,
      'Achat de 10 crédit(s) - 500 FCFA',
    );
  });

  it('does not add credits twice when SASPAY retries a successful webhook', async () => {
    const payment = Object.assign(new SaspayPayment(), {
      id: PAYMENT_ID,
      userId: USER_ID,
      creditPackId: 'pack-500',
      creditsRequested: 10,
      amountFcfa: 500,
      method: SaspayPaymentMethod.CHECKOUT,
      saspayReference: CHECKOUT_SESSION_ID,
      status: SaspayPaymentStatus.PENDING,
      creditsApplied: false,
    });
    paymentRepoMock.findOne
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce(null);

    const event = makeWebhook();
    await paymentsService.handleWebhookEvent(event);
    await paymentsService.handleWebhookEvent(event);

    expect(payment.status).toBe(SaspayPaymentStatus.SUCCESS);
    expect(payment.creditsApplied).toBe(true);
    expect(creditsServiceMock.creditForPurchase).toHaveBeenCalledTimes(1);
  });

  it('continues to match existing Softpay webhooks by their stored SASPAY transaction ID', async () => {
    const payment = Object.assign(new SaspayPayment(), {
      id: PAYMENT_ID,
      userId: USER_ID,
      creditsRequested: 1,
      amountFcfa: 50,
      method: SaspayPaymentMethod.SOFTPAY,
      saspayReference: 'softpay-transaction-id',
      status: SaspayPaymentStatus.PENDING,
      creditsApplied: false,
    });
    paymentRepoMock.findOne.mockResolvedValueOnce(payment);

    await paymentsService.handleWebhookEvent({
      event: 'transaction.success',
      data: { id: 'softpay-transaction-id', status: 'SUCCESS' },
    });

    expect(payment.status).toBe(SaspayPaymentStatus.SUCCESS);
    expect(creditsServiceMock.creditForPurchase).toHaveBeenCalledTimes(1);
  });
});
