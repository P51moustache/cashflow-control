import { addDays, format, parseISO, getDate, startOfDay } from 'date-fns';
import { Transaction, TransactionType, Frequency, DailyBalance } from '@/types';

export function generateProjection(
  initialBalance: number,
  transactions: Transaction[],
  daysToProject: number = 45
): DailyBalance[] {
  const projection: DailyBalance[] = [];
  let currentRunningBalance = initialBalance;
  const today = startOfDay(new Date());

  for (let i = 0; i < daysToProject; i++) {
    const currentDate = addDays(today, i);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayOfMonth = getDate(currentDate);

    const daysTransactions: Transaction[] = [];

    transactions.forEach((t) => {
      let isDue = false;

      if (t.frequency === Frequency.ONE_TIME) {
        isDue = t.date === dateStr;
      } else if (t.frequency === Frequency.MONTHLY) {
        isDue = t.dayOfMonth === dayOfMonth;
      } else if (t.frequency === Frequency.BI_WEEKLY) {
        const start = parseISO(t.date);
        const diffTime = Math.abs(currentDate.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isDue = diffDays % 14 === 0 && currentDate >= start;
      } else if (t.frequency === Frequency.WEEKLY) {
        const start = parseISO(t.date);
        const diffTime = Math.abs(currentDate.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isDue = diffDays % 7 === 0 && currentDate >= start;
      }

      if (isDue) {
        daysTransactions.push(t);
        if (t.type === TransactionType.INCOME) {
          currentRunningBalance += t.amount;
        } else {
          currentRunningBalance -= t.amount;
        }
      }
    });

    projection.push({
      date: dateStr,
      balance: currentRunningBalance,
      transactions: daysTransactions,
      lowestPoint: false,
    });
  }

  // Find lowest point(s)
  let minBal = Infinity;
  projection.forEach((p) => {
    if (p.balance < minBal) minBal = p.balance;
  });

  projection.forEach((p) => {
    if (p.balance === minBal) p.lowestPoint = true;
  });

  return projection;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatShortCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return formatCurrency(amount);
}

export function getFrequencyLabel(frequency: Frequency): string {
  switch (frequency) {
    case Frequency.ONE_TIME:
      return 'One Time';
    case Frequency.WEEKLY:
      return 'Weekly';
    case Frequency.BI_WEEKLY:
      return 'Bi-Weekly';
    case Frequency.MONTHLY:
      return 'Monthly';
    default:
      return frequency;
  }
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
