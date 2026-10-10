import type { Database } from '../../../core/db';
import { monthRange, occurredAtFor, todayLocalDate } from '../../../shared/lib/dates';
import { createAccountRepository } from '../../accounts/data/accountRepository';
import { createCardRepository } from '../../accounts/data/cardRepository';
import { createBudgetRepository } from '../../budgets/data/budgetRepository';
import { createCategoryRepository } from '../../categories/data/categoryRepository';
import { createSavingsGoalRepository } from '../../savings/data/savingsGoalRepository';
import { buildSavingsOverview } from '../../savings/domain/savingsGoalProgress';
import {
  createTransactionRepository,
  type NewTransaction,
} from '../../transactions/data/transactionRepository';

/** Tests only: every repository over one database. */
export function backupRepositories(database: Database) {
  const { db } = database;
  return {
    accounts: createAccountRepository(db),
    cards: createCardRepository(db),
    categories: createCategoryRepository(db),
    transactions: createTransactionRepository(db),
    budgets: createBudgetRepository(db),
    goals: createSavingsGoalRepository(db),
  };
}

/**
 * Tests only: data in the six tables through the real repositories, with archived rows,
 * a pending movement, a card purchase and payment, two currencies, a budget and a goal.
 * `label` makes the names of different fixtures distinguishable.
 */
export async function seedBackupFixture(database: Database, label = 'A') {
  const repos = backupRepositories(database);
  const today = todayLocalDate();
  const at = occurredAtFor(today, new Date());

  const bank = await repos.accounts.create({
    name: `Banco ${label}`,
    type: 'bank',
    currency: 'GTQ',
    initialBalanceMinor: 500000,
  });
  const savings = await repos.accounts.create({
    name: `Ahorros ${label} ñandú 💰`,
    type: 'savings',
    currency: 'GTQ',
    initialBalanceMinor: 100000,
  });
  const visa = await repos.accounts.create({
    name: `Visa ${label}`,
    type: 'credit_card',
    currency: 'GTQ',
    initialBalanceMinor: -25000,
  });
  const dollars = await repos.accounts.create({
    name: `Dólares ${label}`,
    type: 'cash',
    currency: 'USD',
    initialBalanceMinor: 30000,
  });
  const old = await repos.accounts.create({
    name: `Cuenta vieja ${label}`,
    type: 'other',
    currency: 'GTQ',
    initialBalanceMinor: 0,
  });

  const card = await repos.cards.create({
    accountId: visa.id,
    alias: `Visa oro ${label}`,
    last4: '4242',
    network: 'visa',
  });
  const oldCard = await repos.cards.create({
    accountId: bank.id,
    alias: `Débito viejo ${label}`,
    last4: '1111',
    network: null,
  });
  await repos.cards.softDelete(oldCard.id);

  const food = await repos.categories.create({
    name: `Comida ${label}`,
    kind: 'expense',
    icon: 'restaurant',
  });
  const salary = await repos.categories.create({
    name: `Sueldo ${label}`,
    kind: 'income',
    icon: 'salary',
  });
  const hobby = await repos.categories.create({
    name: `Pasatiempos ${label}`,
    kind: 'expense',
    icon: 'entertainment',
  });

  const movement = (
    fields: Partial<NewTransaction> & Pick<NewTransaction, 'type' | 'amountMinor'>,
  ): NewTransaction => ({
    currency: 'GTQ',
    accountId: bank.id,
    toAccountId: null,
    categoryId: null,
    cardId: null,
    occurredAt: at,
    localDate: today,
    description: null,
    payee: null,
    note: null,
    source: 'manual',
    status: 'confirmed',
    externalRef: null,
    ...fields,
  });

  await repos.transactions.create(
    movement({
      type: 'income',
      amountMinor: 900000,
      categoryId: salary.id,
      payee: `Empresa ${label}`,
    }),
  );
  await repos.transactions.create(
    movement({
      type: 'expense',
      amountMinor: 12550,
      accountId: visa.id,
      cardId: card.id,
      categoryId: food.id,
      payee: `Restaurante ${label}`,
      description: 'Cena "especial" con \\ y emoji 🍕',
    }),
  );
  await repos.transactions.create(
    movement({
      type: 'transfer',
      amountMinor: 12550,
      toAccountId: visa.id,
      note: 'Pago de tarjeta',
    }),
  );
  await repos.transactions.create(
    movement({ type: 'transfer', amountMinor: 200000, toAccountId: savings.id }),
  );
  await repos.transactions.create(
    movement({
      type: 'expense',
      amountMinor: 3000,
      categoryId: hobby.id,
      status: 'pending',
    }),
  );
  await repos.transactions.create(
    movement({
      type: 'expense',
      amountMinor: 1500,
      currency: 'USD',
      accountId: dollars.id,
    }),
  );
  const mistake = await repos.transactions.create(
    movement({ type: 'expense', amountMinor: 99999, categoryId: food.id }),
  );
  await repos.transactions.softDelete(mistake.id);

  await repos.budgets.create({
    categoryId: food.id,
    amountMinor: 150000,
    currency: 'GTQ',
  });
  const oldBudget = await repos.budgets.create({
    categoryId: hobby.id,
    amountMinor: 50000,
    currency: 'GTQ',
  });
  await repos.budgets.softDelete(oldBudget.id);
  await repos.categories.softDelete(hobby.id);

  await repos.goals.create({
    accountId: savings.id,
    name: `Laptop ${label}`,
    targetAmountMinor: 1000000,
    targetDate: '2026-12-15',
  });
  const oldGoal = await repos.goals.create({
    accountId: bank.id,
    name: `Viaje ${label}`,
    targetAmountMinor: 300000,
    targetDate: null,
  });
  await repos.goals.softDelete(oldGoal.id);
  await repos.accounts.softDelete(old.id);

  return { bank, savings, visa, dollars, old, card, food, salary, hobby };
}

/**
 * Tests only: every figure derived from the data (balances, the month's totals, budget
 * spending and savings progress), to compare a database before and after a restore.
 */
export async function derivedFigures(database: Database) {
  const repos = backupRepositories(database);
  const period = monthRange(new Date());
  const [balances, accounts, goals] = await Promise.all([
    repos.transactions.listAccountBalances(),
    repos.accounts.list({ includeArchived: true }),
    repos.goals.list(),
  ]);
  return {
    balances,
    dailyTotals: await repos.transactions.listDailyTotals(period),
    expenseByCategory:
      await repos.transactions.listExpenseTotalsByCategory(period),
    budgets: await repos.budgets.list(),
    savings: buildSavingsOverview(goals, balances, accounts),
  };
}
