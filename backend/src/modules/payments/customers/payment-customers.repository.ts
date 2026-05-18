import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentCustomer } from '../../../database/entities/payment-customer.entity';
import { ResidentPaymentCustomer } from '../../../database/entities/resident-payment-customer.entity';

@Injectable()
export class PaymentCustomersRepository {
  constructor(
    @InjectRepository(PaymentCustomer)
    private readonly customerRepo: Repository<PaymentCustomer>,
    @InjectRepository(ResidentPaymentCustomer)
    private readonly linkRepo: Repository<ResidentPaymentCustomer>,
  ) {}

  findByAccountAndCpf(
    paymentAccountId: string,
    cpf: string,
  ): Promise<PaymentCustomer | null> {
    return this.customerRepo.findOne({
      where: { paymentAccountId, cpf },
    });
  }

  findById(id: string): Promise<PaymentCustomer | null> {
    return this.customerRepo.findOne({ where: { id } });
  }

  /**
   * Resolve "qual `PaymentCustomer` está ativo para esse `Resident`?".
   * Em runtime queremos sempre a linha mais recente em
   * `resident_payment_customers` (responsável pode ter trocado de customer).
   */
  async findCurrentByResident(
    residentId: string,
  ): Promise<PaymentCustomer | null> {
    const link = await this.linkRepo
      .createQueryBuilder('l')
      .where('l.resident_id = :residentId', { residentId })
      .orderBy('l.linked_at', 'DESC')
      .limit(1)
      .getOne();
    if (!link) return null;
    return this.customerRepo.findOne({
      where: { id: link.paymentCustomerId },
    });
  }

  createCustomer(data: Partial<PaymentCustomer>): PaymentCustomer {
    return this.customerRepo.create(data);
  }

  saveCustomer(entity: PaymentCustomer): Promise<PaymentCustomer> {
    return this.customerRepo.save(entity);
  }

  /**
   * Linka `resident → customer`. Se já existe link pra esse customer,
   * faz `ON CONFLICT DO NOTHING` (idempotente). Quando o resident já tinha
   * link pra outro customer, mantemos o histórico (não removemos a linha
   * antiga — `findCurrentByResident` usa `linked_at DESC`).
   */
  async linkResident(
    residentId: string,
    paymentCustomerId: string,
  ): Promise<void> {
    await this.linkRepo
      .createQueryBuilder()
      .insert()
      .into(ResidentPaymentCustomer)
      .values({ residentId, paymentCustomerId })
      .orIgnore()
      .execute();
  }
}
