import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  SaspayPayment,
  SaspayPaymentMethod,
  SaspayPaymentStatus,
} from './entities/saspay-payment.entity';
import { SaspayService } from '../saspay/saspay.service';
import { CreditPacksService } from '../credit-packs/credit-packs.service';
import { CreditsService } from '../credits/credits.service';
import { UsersRepositoryLite } from './users-repository-lite';
import { InitiateCheckoutDto, InitiateSoftpayDto } from './dto/payment.dto';
import { SaspayWebhookEnvelope } from '../saspay/saspay.types';

const SASPAY_MINIMUM_CHECKOUT_AMOUNT_XOF = 200;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erreur inconnue';
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(SaspayPayment)
    private readonly paymentRepo: Repository<SaspayPayment>,
    private readonly saspayService: SaspayService,
    private readonly creditPacksService: CreditPacksService,
    private readonly creditsService: CreditsService,
    private readonly usersRepo: UsersRepositoryLite,
  ) {}

  /**
   * Initie un paiement softpay (push direct sur le téléphone) pour
   * acheter un pack de crédits. Le prix vient TOUJOURS du pack stocké
   * en base (jamais d'un montant envoyé par le frontend).
   */
  async initiateSoftpay(userId: string, dto: InitiateSoftpayDto) {
    const pack = await this.creditPacksService.findOne(dto.creditPackId);
    if (!pack.isActive) {
      throw new BadRequestException("Ce pack de crédits n'est plus disponible");
    }

    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const localPayment = this.paymentRepo.create({
      userId,
      creditPackId: pack.id,
      creditsRequested: pack.credits,
      amountFcfa: pack.priceFcfa,
      method: SaspayPaymentMethod.SOFTPAY,
      status: SaspayPaymentStatus.PENDING,
      network: dto.network,
      phone: dto.phone,
    });
    const saved = await this.paymentRepo.save(localPayment);

    const idempotencyKey = uuidv4();
    this.logger.log(
      `initiateSoftpay: userId=${userId} paymentId=${saved.id} pack=${pack.id} ` +
        `amount=${pack.priceFcfa} network=${dto.network}`,
    );
    try {
      const response = await this.saspayService.initiateSoftpay(
        {
          amount: pack.priceFcfa.toFixed(2),
          currency: this.saspayService.defaultCurrency,
          country: this.saspayService.defaultCountry,
          description: `DocuScan Burkina - ${pack.name}`,
          customer: {
            email: user.email,
            first_name: dto.firstName ?? user.fullName?.split(' ')[0] ?? 'Client',
            last_name: dto.lastName ?? (user.fullName?.split(' ').slice(1).join(' ') || 'DocuScan'),
            phone: dto.phone,
          },
          network: dto.network,
          metadata: { docuscan_payment_id: saved.id, user_id: userId },
        },
        idempotencyKey,
      );

      saved.saspayReference = response.id;
      saved.checkoutUrl = response.checkout_url || undefined;
      saved.status = this.mapSaspayStatus(response.status);
      saved.idempotencyKey = idempotencyKey;
      saved.rawResponse = { ...response };
      await this.paymentRepo.save(saved);

      this.logger.log(
        `initiateSoftpay: succès paymentId=${saved.id} saspayReference=${response.id} status=${response.status}`,
      );

      return saved;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      saved.status = SaspayPaymentStatus.FAILED;
      saved.rawResponse = { error: message };
      await this.paymentRepo.save(saved);
      this.logger.error(`initiateSoftpay: échec paymentId=${saved.id}: ${message}`);
      throw err;
    }
  }

  /** Crée une session de checkout hébergé Saspay pour un pack de crédits. */
  async initiateCheckout(userId: string, dto: InitiateCheckoutDto) {
    const pack = await this.creditPacksService.findOne(dto.creditPackId);
    if (!pack.isActive) {
      throw new BadRequestException("Ce pack de crédits n'est plus disponible");
    }
    if (pack.priceFcfa < SASPAY_MINIMUM_CHECKOUT_AMOUNT_XOF) {
      throw new BadRequestException(
        `Ce pack coûte ${pack.priceFcfa} XOF. Le montant minimum accepté par SASPAY est de ${SASPAY_MINIMUM_CHECKOUT_AMOUNT_XOF} XOF.`,
      );
    }

    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    // Validation explicite AVANT tout appel à Saspay : si return_url n'est
    // pas une URL absolue valide, on refuse l'appel immédiatement avec une
    // erreur claire plutôt que de laisser Saspay répondre 400 et masquer la
    // vraie cause derrière un 502 générique "Erreur Saspay".
    const returnUrl = this.saspayService.getValidatedReturnUrl();

    const localPayment = this.paymentRepo.create({
      userId,
      creditPackId: pack.id,
      creditsRequested: pack.credits,
      amountFcfa: pack.priceFcfa,
      method: SaspayPaymentMethod.CHECKOUT,
      status: SaspayPaymentStatus.PENDING,
    });
    const saved = await this.paymentRepo.save(localPayment);

    this.logger.log(
      `initiateCheckout: userId=${userId} paymentId=${saved.id} pack=${pack.id} ` +
        `amount=${pack.priceFcfa} return_url=${returnUrl}`,
    );

    try {
      const session = await this.saspayService.createCheckoutSession({
        amount: pack.priceFcfa.toFixed(2),
        currency: this.saspayService.defaultCurrency,
        country: this.saspayService.defaultCountry,
        description: `DocuScan Burkina - ${pack.name}`,
        customer_email: user.email,
        customer_name: user.fullName ?? user.email,
        return_url: returnUrl,
        metadata: { docuscan_payment_id: saved.id, user_id: userId },
      });

      saved.saspayReference = session.id;
      saved.checkoutUrl = session.checkout_url;
      saved.status = this.mapSaspayStatus(session.status);
      saved.rawResponse = { ...session };
      await this.paymentRepo.save(saved);

      this.logger.log(
        `initiateCheckout: succès paymentId=${saved.id} saspayReference=${session.id} checkoutUrl=${session.checkout_url}`,
      );

      return saved;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      saved.status = SaspayPaymentStatus.FAILED;
      saved.rawResponse = { error: message };
      await this.paymentRepo.save(saved);
      this.logger.error(`initiateCheckout: échec paymentId=${saved.id}: ${message}`);
      throw err;
    }
  }

  /**
   * Vérifie ACTIVEMENT auprès de Saspay l'état réel d'un paiement (jamais
   * confiance au frontend) et applique les crédits si succès confirmé.
   * Utilisé en polling par le client tant que le webhook n'est pas arrivé.
   */
  async verifyAndReconcile(userId: string, localPaymentId: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id: localPaymentId, userId },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (!payment.saspayReference) return payment;

    if (payment.status === SaspayPaymentStatus.SUCCESS || payment.creditsApplied) {
      return payment;
    }

    try {
      let saspayStatus: string;
      if (payment.method === SaspayPaymentMethod.CHECKOUT) {
        const session = await this.saspayService.getCheckoutSession(payment.saspayReference);
        saspayStatus = session.status;
        payment.rawResponse = { ...session };
      } else {
        const transaction = await this.saspayService.verifyPayment(payment.saspayReference);
        saspayStatus = transaction.status;
        payment.rawResponse = { ...transaction };
      }

      payment.status = this.mapSaspayStatus(saspayStatus);
      await this.paymentRepo.save(payment);

      if (payment.status === SaspayPaymentStatus.SUCCESS) {
        await this.applyCreditsIfNeeded(payment);
      }
    } catch (err: unknown) {
      this.logger.warn(`Échec de vérification Saspay pour ${payment.id}: ${getErrorMessage(err)}`);
    }

    return payment;
  }

  /**
   * Traite un événement webhook Saspay déjà validé (signature vérifiée
   * par le contrôleur). Idempotent : si les crédits ont déjà été
   * appliqués pour ce paiement, ne fait rien de plus.
   */
  async handleWebhookEvent(envelope: SaspayWebhookEnvelope) {
    const { event, data } = envelope;
    const saspayId = data.id;
    if (!saspayId) {
      this.logger.warn(`Webhook Saspay sans id de transaction, event=${event}`);
      return;
    }

    // Pour un checkout hébergé, SASPAY peut envoyer l'id de transaction dans
    // data.id alors que saspayReference contient l'id de session checkout.
    // Les métadonnées envoyées à la création relient les deux lorsqu'elles
    // sont incluses dans l'événement; la recherche par référence reste le
    // fallback pour Softpay et les événements utilisant déjà l'id enregistré.
    const metadataPaymentId = data.metadata?.['docuscan_payment_id'];
    const [paymentByMetadata, paymentByReference] = await Promise.all([
      typeof metadataPaymentId === 'string' && metadataPaymentId.trim()
        ? this.paymentRepo.findOne({ where: { id: metadataPaymentId } })
        : Promise.resolve(null),
      this.paymentRepo.findOne({ where: { saspayReference: saspayId } }),
    ]);

    if (paymentByMetadata && paymentByReference && paymentByMetadata.id !== paymentByReference.id) {
      this.logger.warn(
        `Webhook Saspay: références contradictoires pour la transaction ${saspayId}`,
      );
      return;
    }

    const payment = paymentByMetadata ?? paymentByReference;
    if (!payment) {
      this.logger.warn(`Webhook Saspay reçu pour une transaction inconnue: ${saspayId}`);
      return;
    }

    const metadataUserId = data.metadata?.['user_id'];
    if (
      paymentByMetadata &&
      typeof metadataUserId === 'string' &&
      metadataUserId !== payment.userId
    ) {
      this.logger.warn(
        `Webhook Saspay: user_id des métadonnées incohérent pour le paiement ${payment.id}`,
      );
      return;
    }

    payment.lastWebhookPayload = { ...envelope };

    if (event === 'transaction.success') {
      payment.status = SaspayPaymentStatus.SUCCESS;
      await this.paymentRepo.save(payment);
      await this.applyCreditsIfNeeded(payment);
    } else if (event === 'transaction.failed') {
      payment.status = SaspayPaymentStatus.FAILED;
      await this.paymentRepo.save(payment);
    } else if (event === 'transaction.cancelled') {
      payment.status = SaspayPaymentStatus.CANCELLED;
      await this.paymentRepo.save(payment);
    } else {
      await this.paymentRepo.save(payment);
    }
  }

  /**
   * Crédite le compte utilisateur pour un paiement SUCCESS, de façon
   * idempotente (double protection : `creditsApplied` en base +
   * référence unique dans CreditTransaction gérée par CreditsService).
   */
  private async applyCreditsIfNeeded(payment: SaspayPayment) {
    if (payment.creditsApplied) return;

    await this.creditsService.creditForPurchase(
      payment.userId,
      payment.creditsRequested,
      payment.saspayReference ?? payment.id,
      `Achat de ${payment.creditsRequested} crédit(s) - ${payment.amountFcfa} FCFA`,
    );

    payment.creditsApplied = true;
    await this.paymentRepo.save(payment);
  }

  async findByIdForUser(userId: string, id: string) {
    const payment = await this.paymentRepo.findOne({ where: { id, userId } });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    return payment;
  }

  async listForUser(userId: string, limit = 50, offset = 0) {
    return this.paymentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async listAllForAdmin(limit = 100, offset = 0) {
    return this.paymentRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  private mapSaspayStatus(status: string): SaspayPaymentStatus {
    switch (status) {
      case 'SUCCESS':
        return SaspayPaymentStatus.SUCCESS;
      case 'FAILED':
        return SaspayPaymentStatus.FAILED;
      case 'CANCELLED':
        return SaspayPaymentStatus.CANCELLED;
      default:
        return SaspayPaymentStatus.PENDING;
    }
  }
}
