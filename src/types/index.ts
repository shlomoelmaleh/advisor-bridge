
export type UserRole = 'advisor' | 'bank';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  company?: string;
}

export interface MortgageCase {
  id: string;
  advisorId: string;
  createdAt: string;
  status: 'open' | 'in_progress' | 'matched' | 'closed';
  loanAmount: number;
  dealType: 'purchase' | 'refinance' | 'equity' | 'other';
  financingPercentage: number;
  borrowerIncome: number;
  borrowerObligations: number;
  loanStructure?: string;
  interestedBanks: string[];
  notes?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'new_case' | 'case_interest' | 'message' | 'status_update';
  read: boolean;
  createdAt: string;
  relatedCaseId?: string;
  message: string;
}
