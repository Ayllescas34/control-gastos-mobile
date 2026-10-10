import type { EntityId } from '../../../shared/domain';
import { validateAccount } from '../../accounts/domain/validateAccount';
import { validateCardFields } from '../../accounts/domain/validateCard';
import { validateBudget } from '../../budgets/domain/validateBudget';
import { validateCategory } from '../../categories/domain/validateCategory';
import { validateSavingsGoal } from '../../savings/domain/validateSavingsGoal';
import { validateTransaction } from '../../transactions/domain/validateTransaction';
import type { BackupProblem, BackupProblemCode } from './backupErrors';
import { BACKUP_TABLES, type BackupData, type BackupTable } from './types';

const isActive = (row: { deletedAt: string | null }) => row.deletedAt === null;

/** Domain error codes that mean "the referenced row is not in the backup". */
const MISSING_REFERENCE = new Set([
  'account_not_found',
  'to_account_not_found',
  'category_not_found',
]);

/** Domain error codes that mean "breaks a one-active rule" (a partial unique index). */
const DUPLICATE_ACTIVE = new Set([
  'budget_duplicate',
  'account_has_goal',
  'name_duplicate',
]);

function codeOf(rule: string): BackupProblemCode {
  if (MISSING_REFERENCE.has(rule)) {
    return 'broken_reference';
  }
  if (DUPLICATE_ACTIVE.has(rule)) {
    return 'duplicate_active';
  }
  return 'rule_violation';
}

/**
 * Rules between rows of a backup whose fields already passed the format checks (pure, no
 * I/O). The data must be what a valid database can hold, archived rows included:
 *
 * - unique ids per table;
 * - every reference points to a row of the backup (the schema's foreign keys);
 * - the one-active rules of the schema's partial unique indexes (category name per kind,
 *   budget per category and currency, goal per account);
 * - the domain validators, applied as on an edit: history may reference archived rows;
 * - invariants the app keeps: an active card or goal belongs to an active account, and an
 *   active goal's account is not a credit card.
 */
export function validateBackupData(data: BackupData): BackupProblem[] {
  const problems: BackupProblem[] = [];
  const report = (
    table: BackupTable,
    index: number,
    rules: readonly string[],
  ) => {
    for (const rule of rules) {
      problems.push({ code: codeOf(rule), table, index, rule });
    }
  };

  for (const table of BACKUP_TABLES) {
    const seen = new Set<EntityId>();
    data[table].forEach(({ id }, index) => {
      if (seen.has(id)) {
        problems.push({ code: 'duplicate_id', table, index });
      }
      seen.add(id);
    });
  }

  const accounts = new Map(data.accounts.map(a => [a.id, a]));
  const categories = new Map(data.categories.map(c => [c.id, c]));
  const activeCategories = data.categories.filter(isActive);
  const activeBudgets = data.budgets.filter(isActive);
  const activeGoals = data.savingsGoals.filter(isActive);

  data.accounts.forEach((account, index) => {
    report('accounts', index, validateAccount(account).errors);
  });

  data.categories.forEach((category, index) => {
    report(
      'categories',
      index,
      validateCategory(category, {
        existing: isActive(category) ? activeCategories : [],
        currentId: category.id,
      }).errors,
    );
  });

  data.cards.forEach((card, index) => {
    const rules: string[] = validateCardFields(card);
    const account = accounts.get(card.accountId);
    if (!account) {
      problems.push({ code: 'broken_reference', table: 'cards', index });
    } else if (isActive(card) && !isActive(account)) {
      rules.push('active_card_on_archived_account');
    }
    report('cards', index, rules);
  });

  // Every account, card and category counts: past movements may use archived ones.
  const context = {
    accounts: data.accounts,
    cards: data.cards,
    categories: data.categories,
  };
  data.transactions.forEach((transaction, index) => {
    const rules = validateTransaction(transaction, context).errors.map(
      (rule): string =>
        rule === 'card_not_in_account' &&
        !data.cards.some(card => card.id === transaction.cardId)
          ? 'card_not_found'
          : rule,
    );
    for (const rule of rules) {
      problems.push({
        code: rule === 'card_not_found' ? 'broken_reference' : codeOf(rule),
        table: 'transactions',
        index,
        rule,
      });
    }
  });

  data.budgets.forEach((budget, index) => {
    report(
      'budgets',
      index,
      validateBudget(budget, {
        category: categories.get(budget.categoryId) ?? null,
        existing: isActive(budget) ? activeBudgets : [],
        // As an edit: a budget keeps a category archived after its creation.
        currentId: budget.id,
      }).errors,
    );
  });

  data.savingsGoals.forEach((goal, index) => {
    const account = accounts.get(goal.accountId) ?? null;
    const rules: string[] = validateSavingsGoal(goal, {
      account,
      existing: isActive(goal) ? activeGoals : [],
      currentId: goal.id,
    }).errors;
    if (account && isActive(goal)) {
      if (!isActive(account)) {
        rules.push('active_goal_on_archived_account');
      }
      if (account.type === 'credit_card') {
        rules.push('active_goal_on_credit_card');
      }
    }
    report('savingsGoals', index, rules);
  });

  return problems;
}
