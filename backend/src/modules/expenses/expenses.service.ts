import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IStorageAdapter,
  STORAGE_ADAPTER,
} from '../../adapters/storage/storage.adapter';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { randomUUID } from 'crypto';
import { Expense } from '../../database/entities/expense.entity';
import { ExpenseApprovalStatus } from '../../common/enums';
import { ExpensesRepository } from './expenses.repository';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly expensesRepo: ExpensesRepository,
    @Inject(STORAGE_ADAPTER)
    private readonly storage: IStorageAdapter,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private bucket(): string {
    return this.config.get('STORAGE_BUCKET', { infer: true });
  }

  async list(condominiumId: string): Promise<Expense[]> {
    return this.expensesRepo.findByCondo(condominiumId);
  }

  async create(
    condominiumId: string,
    userId: string,
    dto: CreateExpenseDto,
    file?: Express.Multer.File,
  ): Promise<Expense> {
    let storageKey: string | null = null;
    if (file?.buffer?.length) {
      storageKey = `expenses/${condominiumId}/${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await this.storage.uploadObject(
        this.bucket(),
        storageKey,
        file.buffer,
        file.mimetype || 'application/octet-stream',
      );
    }
    const row = this.expensesRepo.create({
      condominiumId,
      description: dto.description,
      amount: String(dto.amount),
      expenseDate: dto.expenseDate.slice(0, 10),
      category: dto.category,
      vendor: dto.vendor ?? null,
      storageKey,
      approvalStatus: ExpenseApprovalStatus.APPROVED,
      createdByUserId: userId,
    });
    return this.expensesRepo.save(row);
  }

  async update(
    condominiumId: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const e = await this.expensesRepo.findById(id, condominiumId);
    if (!e) {
      throw new NotFoundException('Despesa não encontrada.');
    }
    if (dto.description !== undefined) e.description = dto.description;
    if (dto.amount !== undefined) e.amount = String(dto.amount);
    if (dto.expenseDate !== undefined)
      e.expenseDate = dto.expenseDate.slice(0, 10);
    if (dto.category !== undefined) e.category = dto.category;
    if (dto.vendor !== undefined) e.vendor = dto.vendor ?? null;
    return this.expensesRepo.save(e);
  }

  async remove(condominiumId: string, id: string): Promise<void> {
    const e = await this.expensesRepo.findById(id, condominiumId);
    if (!e) {
      throw new NotFoundException('Despesa não encontrada.');
    }
    if (e.storageKey) {
      await this.storage.deleteObject(this.bucket(), e.storageKey);
    }
    await this.expensesRepo.remove(e);
  }

  async summary(condominiumId: string, from?: string, to?: string) {
    return this.expensesRepo.summarizeByCategory(condominiumId, from, to);
  }
}
