import type { DbCase } from './cases';
import type { BranchAppetite } from './appetites';

export type MatchStatus = 'pending' | 'interested' | 'rejected' | 'closed';

/** Represents a row in the `matches` table */
export interface DbMatch {
    id: string;
    case_id: string;
    appetite_id: string;
    score: number;
    status: MatchStatus;
    advisor_status: 'pending' | 'interested' | 'rejected';
    banker_status: 'pending' | 'interested' | 'rejected';
    created_at: string;
}

/** 
 * Represents a Match joined with its corresponding Case and Appetite data.
 * This is what the `useMatches` hook will return.
 */
export interface MatchWithDetails extends DbMatch {
    case: Pick<
        DbCase,
        'advisor_id' | 'loan_amount_min' | 'loan_amount_max' | 'ltv' | 'borrower_type' | 'region' | 'status'
    >;
    appetite: Pick<
        BranchAppetite,
        'bank_name' | 'branch_name' | 'appetite_level' | 'sla_days' | 'banker_id'
    >;
}
