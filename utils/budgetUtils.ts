import { BudgetCategory, BudgetGroup, BudgetMonth, Transaction } from '../types';
import { normalizeDate } from './dateUtils';

export const getPlannedAmount = (cat: BudgetCategory, monthKey: string, budgetOverrides: BudgetMonth[]) => {
    const override = budgetOverrides.find(o => o.category_id === cat.id && o.month === monthKey);
    return override ? override.amount : cat.planned_amount;
};

export const getCalendarBurnRate = (
    viewDate: Date, 
    todayInTimezone: string, 
    budgetGroups: BudgetGroup[], 
    budgetOverrides: BudgetMonth[],
    transactions: Transaction[]
) => {
    // Parse today's date components directly from the string to avoid timezone shifts
    // todayInTimezone is expected to be YYYY-MM-DD
    const [tYear, tMonth, tDay] = todayInTimezone.split('-').map(Number);
    const todayMonthIndex = tMonth - 1; // 0-indexed month for comparison

    // If viewDate is in the past (before current month), return 0
    if (viewDate.getFullYear() < tYear || (viewDate.getFullYear() === tYear && viewDate.getMonth() < todayMonthIndex)) {
        return { rate: 0, startDay: 0, isProjected: false };
    }
    
    const monthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const startStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-01`;
    const endStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${daysInMonth}`;
    
    let startDay = 1;
    let divisor = daysInMonth;
    
    const isCurrentMonth = viewDate.getFullYear() === tYear && viewDate.getMonth() === todayMonthIndex;
    
    if (isCurrentMonth) {
        startDay = tDay;
        divisor = daysInMonth - startDay + 1;
    }

    let totalVarRemaining = 0;
    budgetGroups.forEach(g => { 
        if (g.type === 'expense' || g.type === 'goal' || g.type === 'income') {
            g.categories.filter(c => !c.is_fixed).forEach(c => {
                const planned = getPlannedAmount(c, monthKey, budgetOverrides);
                
                const actual = transactions.filter(t => 
                    t.category === c.name && 
                    normalizeDate(t.transaction_date) >= startStr && 
                    normalizeDate(t.transaction_date) <= endStr && 
                    t.status !== 'skipped' &&
                    (g.type === 'income' ? t.amount > 0 : t.amount < 0)
                ).reduce((a, t) => a + Math.abs(t.amount), 0);

                const remaining = Math.max(0, planned - actual);
                
                if (g.type === 'income') {
                    totalVarRemaining -= remaining; // Income reduces the burn rate (which is subtracted)
                } else {
                    totalVarRemaining += remaining; // Expenses increase the burn rate
                }
            });
        }
    });
    
    return { rate: totalVarRemaining / divisor, startDay: startDay, isProjected: true };
};
