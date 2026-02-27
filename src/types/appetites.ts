// DB-aligned types for the `branch_appetites` Supabase table

export type AppetiteLevel = 'high' | 'medium' | 'low';

export interface BranchAppetite {
    id: string;
    banker_id: string;
    bank_name: string;
    branch_name: string;
    appetite_level: AppetiteLevel;
    min_loan_amount: number;
    max_ltv: number;
    preferred_borrower_types: string[];
    preferred_regions: string[];
    sla_days: number;
    valid_until: string;      // ISO date string (YYYY-MM-DD)
    is_active: boolean;
    created_at: string;
}

/** Payload when creating / updating an appetite (banker_id added by hook) */
export type UpsertAppetiteData = Omit<BranchAppetite, 'id' | 'banker_id' | 'is_active' | 'created_at'>;
