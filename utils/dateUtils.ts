import { Transaction } from '../types';

// Returns YYYY-MM-DD in the specific timezone
export const getTodayInTimezone = (timezone: string): string => {
    try {
        return new Intl.DateTimeFormat('en-CA', { // en-CA defaults to YYYY-MM-DD
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    } catch (e) {
        // Fallback to local if timezone is invalid
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};

// Robustly normalizes any date string (ISO, timestamp, etc) to YYYY-MM-DD
export const normalizeDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    // 1. Strip time component if present (ISO string)
    const raw = dateStr.split('T')[0];
    // 2. Ensure padding for Month and Day (2024-2-1 -> 2024-02-01)
    const parts = raw.split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return raw;
};

export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

export const addDate = (date: Date, amount: number, unit: 'days' | 'weeks' | 'months' | 'years'): Date => {
    const d = new Date(date);
    if (unit === 'days') d.setDate(d.getDate() + amount);
    if (unit === 'weeks') d.setDate(d.getDate() + (amount * 7));
    if (unit === 'months') d.setMonth(d.getMonth() + amount);
    if (unit === 'years') d.setFullYear(d.getFullYear() + amount);
    return d;
};

// Simple UUID generator fallback
export const uuidv4 = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const generateRecurringSeries = (baseTxn: Transaction, existingRecurrenceId?: string): Transaction[] => {
    if (!baseTxn.is_recurring || !baseTxn.recur_frequency || !baseTxn.recur_period) return [baseTxn];

    const rows: Transaction[] = [];
    const recurrenceId = existingRecurrenceId || uuidv4();
    
    // Parse start date safely ensuring noon to avoid timezone flip issues on naive dates
    const [y, m, d] = baseTxn.transaction_date.split('-').map(Number);
    let currentDate = new Date(y, m - 1, d, 12, 0, 0);
    
    // Default to 2 years if no end date
    const endDateLimit = baseTxn.recur_end_date ? new Date(baseTxn.recur_end_date) : new Date();
    if (!baseTxn.recur_end_date) endDateLimit.setFullYear(endDateLimit.getFullYear() + 2);
    endDateLimit.setHours(12, 0, 0);

    // First transaction (the anchor)
    // Important: The anchor transaction keeps the user-selected status (e.g. Cleared/Pending)
    // We strip 'id' here to ensure we don't accidentally try to insert a duplicate PK if we are generating a fresh list
    const { id, ...rest } = baseTxn; 
    rows.push({ ...rest, recurrence_id: recurrenceId });

    let safetyCounter = 0;
    while (safetyCounter < 200) {
        currentDate = addDate(currentDate, baseTxn.recur_frequency, baseTxn.recur_period);
        if (currentDate > endDateLimit) break;
        
        const nextDateStr = formatDate(currentDate);
        
        // Future occurrences are 'expected' by default
        rows.push({
            ...rest, // Use rest to exclude ID
            transaction_date: nextDateStr,
            recurrence_id: recurrenceId,
            status: 'expected'
        });
        safetyCounter++;
    }
    
    return rows;
};

export const getMonthName = (monthIndex: number) => {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return months[monthIndex];
};