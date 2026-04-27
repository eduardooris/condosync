import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../../database/entities/expense.entity';
import { ExpenseApprovalStatus } from '../../common/enums';

@Injectable()
export class ExpensesRepository {
  constructor(
    @InjectRepository(Expense)
    private readonly repo: Repository<Expense>,
  ) {}

  findByCondo(condominiumId: string) {
    return this.repo.find({
      where: { condominiumId },
      order: { expenseDate: 'DESC' },
    });
  }

  findById(id: string, condominiumId: string) {
    return this.repo.findOne({ where: { id, condominiumId } });
  }

  findLastByCondo(condominiumId: string, take: number) {
    return this.repo.find({
      where: { condominiumId },
      order: { expenseDate: 'DESC' },
      take,
    });
  }

  summarizeByCategory(condominiumId: string, from?: string, to?: string) {
    const qb = this.repo
      .createQueryBuilder('e')
      .select('e.category', 'category')
      .addSelect('SUM(e.amount::numeric)', 'total')
      .where('e.condominium_id = :condominiumId', { condominiumId })
      .andWhere('e.approval_status = :st', {
        st: ExpenseApprovalStatus.APPROVED,
      })
      .groupBy('e.category');
    if (from) qb.andWhere('e.expense_date >= :from', { from });
    if (to) qb.andWhere('e.expense_date <= :to', { to });
    return qb.getRawMany();
  }

  create(data: Partial<Expense>) {
    return this.repo.create(data as Expense);
  }

  save(entity: Expense) {
    return this.repo.save(entity);
  }

  remove(entity: Expense) {
    return this.repo.remove(entity);
  }
}
