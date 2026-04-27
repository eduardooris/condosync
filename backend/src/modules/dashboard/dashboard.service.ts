import { Injectable } from '@nestjs/common';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepo: DashboardRepository) {}

  async summary(condominiumId: string) {
    const [paid, expenses, inadimplencia, lastExpenses] = await Promise.all([
      this.dashboardRepo.sumPaidCharges(condominiumId),
      this.dashboardRepo.sumApprovedExpenses(condominiumId),
      this.dashboardRepo.countInadimplencia(condominiumId),
      this.dashboardRepo.findLastExpenses(condominiumId, 10),
    ]);

    const receitas = Number(paid?.total ?? 0);
    const despesas = Number(expenses?.total ?? 0);

    return {
      saldoAtual: receitas - despesas,
      inadimplenciaUnidades: inadimplencia,
      totalReceitasPagas: receitas,
      totalDespesasAprovadas: despesas,
      ultimasDespesas: lastExpenses,
    };
  }

  async chart(condominiumId: string) {
    return this.dashboardRepo.chartData(condominiumId);
  }
}
