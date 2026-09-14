import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/entities/user.entity';
import { CreditTransaction } from '../credits/entities/credit-transaction.entity';
import { SaspayPayment, SaspayPaymentStatus } from '../payments/entities/saspay-payment.entity';
import { DocumentExportLog } from '../documents/entities/document-log.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { CreditsService } from '../credits/credits.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CreditTransaction)
    private readonly txRepo: Repository<CreditTransaction>,
    @InjectRepository(SaspayPayment)
    private readonly paymentRepo: Repository<SaspayPayment>,
    @InjectRepository(DocumentExportLog)
    private readonly docLogRepo: Repository<DocumentExportLog>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
    private readonly creditsService: CreditsService,
  ) {}

  async dashboard() {
    const [totalUsers, activeUsers, totalDocuments, allSuccessPayments, pendingPayments, failedPayments] =
      await Promise.all([
        this.userRepo.count(),
        this.userRepo.count({ where: { isActive: true } }),
        this.docLogRepo.count(),
        this.paymentRepo.find({ where: { status: SaspayPaymentStatus.SUCCESS } }),
        this.paymentRepo.count({ where: { status: SaspayPaymentStatus.PENDING } }),
        this.paymentRepo.count({ where: { status: SaspayPaymentStatus.FAILED } }),
      ]);

    const revenueFcfa = allSuccessPayments.reduce((sum, p) => sum + p.amountFcfa, 0);
    const creditsSold = allSuccessPayments.reduce((sum, p) => sum + p.creditsRequested, 0);

    return {
      totalUsers,
      activeUsers,
      totalDocuments,
      revenueFcfa,
      creditsSold,
      successfulPayments: allSuccessPayments.length,
      pendingPayments,
      failedPayments,
    };
  }

  async listUsers(limit = 50, offset = 0, search?: string) {
    const qb = this.userRepo.createQueryBuilder('user').orderBy('user.createdAt', 'DESC');
    if (search) {
      qb.where('user.email ILIKE :search OR user.fullName ILIKE :search', {
        search: `%${search}%`,
      });
    }
    qb.take(limit).skip(offset);
    const [users, total] = await qb.getManyAndCount();
    return {
      users: users.map(({ passwordHash, refreshTokenHash, ...rest }) => rest),
      total,
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const [transactions, payments, documents] = await Promise.all([
      this.txRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }),
      this.paymentRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }),
      this.docLogRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }),
    ]);

    const { passwordHash, refreshTokenHash, ...safeUser } = user;
    return { user: safeUser, transactions, payments, documents };
  }

  async setUserActive(userId: string, isActive: boolean, adminId: string, adminEmail: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    user.isActive = isActive;
    await this.userRepo.save(user);

    await this.auditRepo.save(
      this.auditRepo.create({
        adminId,
        adminEmail,
        action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        targetUserId: userId,
      }),
    );

    return { success: true };
  }

  async adjustCredits(
    userId: string,
    amount: number,
    reason: string,
    adminId: string,
    adminEmail: string,
  ) {
    const idempotencyKey = uuidv4();
    const transaction = await this.creditsService.adminAdjust(
      userId,
      amount,
      adminId,
      reason,
      idempotencyKey,
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        adminId,
        adminEmail,
        action: 'CREDIT_ADJUSTMENT',
        targetUserId: userId,
        metadata: { amount, reason, transactionId: transaction.id },
      }),
    );

    return transaction;
  }

  async listPayments(limit = 100, offset = 0, status?: SaspayPaymentStatus) {
    const where = status ? { status } : {};
    const [payments, total] = await this.paymentRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { payments, total };
  }

  async listFailedPayments(limit = 100) {
    return this.paymentRepo.find({
      where: { status: SaspayPaymentStatus.FAILED },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async listAuditLogs(limit = 100) {
    return this.auditRepo.find({ order: { createdAt: 'DESC' }, take: limit });
  }
}
