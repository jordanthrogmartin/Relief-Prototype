CREATE OR REPLACE FUNCTION get_view_data(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_current_month_start DATE,
    p_current_month_end DATE,
    p_today DATE
) RETURNS JSON AS $$
DECLARE
    v_view_opening_balance NUMERIC;
    v_snapshot_balance NUMERIC;
    v_snapshot_month TEXT;
    v_view_transactions JSON;
    
    v_current_opening_balance NUMERIC;
    v_current_snapshot_month TEXT;
    v_current_transactions JSON;

    v_offset NUMERIC := 0;
    v_month_offset NUMERIC := 0;
    v_month_start DATE;
    v_month_end DATE;
    v_month_str TEXT;
BEGIN
    -- 1. View Window Opening Balance (Base)
    v_snapshot_month := to_char(p_start_date - INTERVAL '1 month', 'YYYY-MM');
    SELECT balance INTO v_snapshot_balance FROM monthly_snapshots WHERE user_id = p_user_id AND month = v_snapshot_month;
    
    IF v_snapshot_balance IS NOT NULL THEN
        v_view_opening_balance := v_snapshot_balance;
    ELSE
        SELECT COALESCE(SUM(amount), 0) INTO v_view_opening_balance FROM transactions WHERE user_id = p_user_id AND transaction_date < p_start_date AND status != 'skipped';
    END IF;

    -- 1b. Add Unspent Variable Budget Offset for Future Months
    -- This loops from the current month up to the month right before p_start_date
    v_month_start := date_trunc('month', p_today)::DATE;
    WHILE v_month_start < p_start_date LOOP
        v_month_end := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
        v_month_str := to_char(v_month_start, 'YYYY-MM');
        
        SELECT COALESCE(SUM(
            CASE 
                WHEN bg.type IN ('expense', 'goal') THEN 
                    -1 * GREATEST(0, 
                        COALESCE(bo.amount, bc.planned_amount) - 
                        COALESCE((
                            SELECT SUM(ABS(t.amount)) 
                            FROM transactions t 
                            WHERE t.user_id = p_user_id 
                              AND t.category = bc.name 
                              AND t.transaction_date >= v_month_start 
                              AND t.transaction_date <= v_month_end
                              AND t.status != 'skipped'
                              AND t.amount < 0
                        ), 0)
                    )
                WHEN bg.type = 'income' THEN 
                    GREATEST(0, 
                        COALESCE(bo.amount, bc.planned_amount) - 
                        COALESCE((
                            SELECT SUM(ABS(t.amount)) 
                            FROM transactions t 
                            WHERE t.user_id = p_user_id 
                              AND t.category = bc.name 
                              AND t.transaction_date >= v_month_start 
                              AND t.transaction_date <= v_month_end
                              AND t.status != 'skipped'
                              AND t.amount > 0
                        ), 0)
                    )
                ELSE 0
            END
        ), 0) INTO v_month_offset
        FROM budget_categories bc
        JOIN budget_groups bg ON bc.group_id = bg.id
        LEFT JOIN budget_months bo ON bo.category_id = bc.id AND bo.month = v_month_str
        WHERE bg.user_id = p_user_id AND bc.is_fixed = false;
        
        v_offset := v_offset + v_month_offset;
        v_month_start := (v_month_start + INTERVAL '1 month')::DATE;
    END LOOP;

    -- Apply the unspent variable offset to the opening balance
    v_view_opening_balance := v_view_opening_balance + v_offset;

    -- 2. View Window Transactions
    SELECT COALESCE(json_agg(t ORDER BY transaction_date DESC), '[]'::json) INTO v_view_transactions
    FROM transactions t WHERE user_id = p_user_id AND transaction_date >= p_start_date AND transaction_date <= p_end_date;

    -- 3. Current Month Opening Balance (for stats)
    v_current_snapshot_month := to_char(p_current_month_start - INTERVAL '1 month', 'YYYY-MM');
    SELECT balance INTO v_snapshot_balance FROM monthly_snapshots WHERE user_id = p_user_id AND month = v_current_snapshot_month;
    
    IF v_snapshot_balance IS NOT NULL THEN
        v_current_opening_balance := v_snapshot_balance;
    ELSE
        SELECT COALESCE(SUM(amount), 0) INTO v_current_opening_balance FROM transactions WHERE user_id = p_user_id AND transaction_date < p_current_month_start AND status != 'skipped';
    END IF;

    -- 4. Current Month Transactions (for stats)
    SELECT COALESCE(json_agg(t ORDER BY transaction_date ASC), '[]'::json) INTO v_current_transactions
    FROM transactions t WHERE user_id = p_user_id AND transaction_date >= p_current_month_start AND transaction_date <= p_current_month_end;

    RETURN json_build_object(
        'view_opening_balance', COALESCE(v_view_opening_balance, 0),
        'view_transactions', COALESCE(v_view_transactions, '[]'::json),
        'current_opening_balance', COALESCE(v_current_opening_balance, 0),
        'current_transactions', COALESCE(v_current_transactions, '[]'::json),
        'debug_offset', v_offset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
