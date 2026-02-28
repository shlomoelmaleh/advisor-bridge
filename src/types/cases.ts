// DB-aligned Case types (snake_case, matching the `cases` Supabase table)

export interface CasePriorities {
    speed: boolean;
    rate: boolean;
    ltv: boolean;
}

export type CaseStatus = 'open' | 'in_progress' | 'matched' | 'closed';
export type BorrowerType = 'employee' | 'self_employed';

/** Row shape returned from Supabase */
export interface DbCase {
    id: string;
    advisor_id: string;
    loan_amount_min: number;
    loan_amount_max: number;
    ltv: number;
    borrower_type: BorrowerType;
    property_type: string;
    region: string;
    priorities: CasePriorities;
    status: CaseStatus;
    created_at: string;
    last_matched_at?: string | null;
    is_anonymous?: boolean;
    is_approved?: boolean;
}

/** Shape used when inserting a new case (advisor_id + status added by hook) */
export type CreateCaseData = Omit<DbCase, 'id' | 'advisor_id' | 'status' | 'created_at'>;
