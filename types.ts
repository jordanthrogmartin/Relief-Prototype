
export type TransactionType = 'income' | 'expense' | 'goal' | 'transfer';
export type TransactionStatus = 'cleared' | 'pending' | 'expected' | 'skipped';

export interface Transaction {
    id?: string;
    user_id: string;
    name: string;
    merchant?: string;
    amount: number;
    transaction_date: string; // YYYY-MM-DD
    type: TransactionType;
    status: TransactionStatus;
    category?: string;
    budget_group?: string;
    notes?: string;
    is_recurring?: boolean;
    recurrence_id?: string;
    recur_frequency?: number;
    recur_period?: 'days' | 'weeks' | 'months' | 'years';
    recur_end_date?: string;
    created_at?: string;
    is_ghost?: boolean;
    
    // New Fields for Sync/Rules
    original_statement?: string;
    source?: 'manual' | 'automatic';
    account_id?: string; 
    
    // Smart Assist State
    candidate_type?: 'missing' | 'conflict';
}

export interface BudgetGroup {
    id: string;
    user_id: string;
    name: string;
    type: TransactionType;
    sort_order: number;
    categories: BudgetCategory[];
}

export interface BudgetCategory {
    id: string;
    user_id?: string;
    group_id: string;
    name: string;
    planned_amount: number;
    is_fixed: boolean;
    sort_order: number;
}

export interface BudgetMonth {
    id: string;
    user_id: string;
    category_id: string;
    month: string; // YYYY-MM
    amount: number;
}

export interface UserProfile {
    id: string;
    display_name?: string;
    full_name?: string;
    birthday?: string;
    timezone?: string;
    balance_warning_threshold?: number;
    has_completed_onboarding?: boolean;
    preferences?: {
        hidden_categories?: string[];
        dashboard_order?: string[];
    };
}

// --- Rule Types ---

export type RuleOperator = 'contains' | 'is' | 'starts_with' | 'ends_with' | 'gt' | 'lt' | 'eq';

// Updated Fields based on request
export type RuleField = 'merchant' | 'name' | 'amount' | 'original_statement' | 'category' | 'account_id';

// Updated Actions based on request
export type ActionType = 'set_category' | 'rename_merchant' | 'update_note' | 'set_status';

export interface RuleCondition {
    field: RuleField;
    operator: RuleOperator;
    value: string | number;
}

export interface RuleAction {
    type: ActionType;
    value: string;
}

export interface TransactionRule {
    id: string;
    user_id: string;
    name: string;
    conditions: RuleCondition[];
    actions: RuleAction[];
    is_active: boolean;
    created_at?: string;
}
