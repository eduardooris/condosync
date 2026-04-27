import { test, expect } from '@playwright/test';

test('carrega tela de login', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Entrar no CondoSync')).toBeVisible();
});

test('redireciona rota protegida sem sessão', async ({ page }) => {
  await page.goto('/charges');
  await expect(page).toHaveURL(/\/login$/);
});

test('abre módulos principais com sessão persistida', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'condosync-auth',
      JSON.stringify({
        state: {
          user: { id: 'u1', name: 'QA User', email: 'qa@condosync.com' },
          token: 'mock.token.value',
          role: 'ADMIN',
          activeCondominium: {
            id: 'c1',
            name: 'Condo QA',
            role: 'ADMIN',
            unitId: null,
          },
        },
        version: 0,
      }),
    );
  });

  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/dashboard/chart')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.includes('/dashboard')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          saldoAtual: 0,
          inadimplenciaUnidades: 0,
          totalReceitasPagas: 0,
          totalDespesasAprovadas: 0,
          ultimasDespesas: [],
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/');
  await expect(page.getByText(/Condom[ií]nio ativo/i)).toBeVisible();

  await page.goto('/charges');
  await expect(page.getByText('Cobrancas')).toBeVisible();

  await page.goto('/polls');
  await expect(page.getByText('Nova enquete')).toBeVisible();

  await page.goto('/occurrences');
  await expect(page.getByText('Nova ocorrência')).toBeVisible();
});
