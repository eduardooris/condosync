import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Charge } from '../../database/entities/charge.entity';
import { Expense } from '../../database/entities/expense.entity';
import { ChargeStatus, ExpenseApprovalStatus } from '../../common/enums';

@Injectable()
export class DashboardRepository {
  constructor(
    @InjectRepository(Charge)
    private readonly chargeRepo: Repository<Charge>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
  ) {}

  sumPaidCharges(condominiumId: string) {
    return this.chargeRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.amount::numeric),0)', 'total')
      .innerJoin('c.unit', 'u')
      .where('u.condominium_id = :condominiumId', { condominiumId })
      .andWhere('c.status = :st', { st: ChargeStatus.PAID })
      .getRawOne<{ total: string }>();
  }

  sumApprovedExpenses(condominiumId: string) {
    return this.expenseRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount::numeric),0)', 'total')
      .where('e.condominium_id = :condominiumId', { condominiumId })
      .andWhere('e.approval_status = :ap', {
        ap: ExpenseApprovalStatus.APPROVED,
      })
      .getRawOne<{ total: string }>();
  }

  countInadimplencia(condominiumId: string) {
    return this.chargeRepo
      .createQueryBuilder('c')
      .innerJoin('c.unit', 'u')
      .where('u.condominium_id = :condominiumId', { condominiumId })
      .andWhere('c.status IN (:...st)', {
        st: [ChargeStatus.PENDING, ChargeStatus.OVERDUE],
      })
      .getCount();
  }

  findLastExpenses(condominiumId: string, take: number) {
    return this.expenseRepo.find({
      where: { condominiumId },
      order: { expenseDate: 'DESC' },
      take,
    });
  }

  chartData(condominiumId: string) {
    return this.chargeRepo.manager.query(
      `
      SELECT to_char(m, 'YYYY-MM') AS month,
        COALESCE((
          SELECT SUM(c.amount::numeric) FROM charges c
          INNER JOIN units u ON u.id = c.unit_id
          WHERE u.condominium_id = $1 AND c.status = 'PAID'
          AND to_char(c.paid_at, 'YYYY-MM') = to_char(m, 'YYYY-MM')
        ),0) AS receitas,
        COALESCE((
          SELECT SUM(e.amount::numeric) FROM expenses e
          WHERE e.condominium_id = $1 AND e.approval_status = 'APPROVED'
          AND to_char(e.expense_date::timestamp, 'YYYY-MM') = to_char(m, 'YYYY-MM')
        ),0) AS despesas
      FROM generate_series(
        date_trunc('month', now()) - interval '11 months',
        date_trunc('month', now()),
        interval '1 month'
      ) AS m
      ORDER BY month
      `,
      [condominiumId],
    );
  }
}
