
import { User, MortgageCase, Notification } from '@/types';

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Advisor',
    email: 'john@advisorgroup.com',
    role: 'advisor',
    company: 'Financial Advisors Ltd',
    avatar: 'https://i.pravatar.cc/150?img=1'
  },
  {
    id: '2',
    name: 'Sarah Mortgage',
    email: 'sarah@advisorgroup.com',
    role: 'advisor',
    company: 'Mortgage Masters',
    avatar: 'https://i.pravatar.cc/150?img=5'
  },
  {
    id: '3',
    name: 'Michael Bank',
    email: 'michael@nationalbank.com',
    role: 'bank',
    company: 'National Banking Group',
    avatar: 'https://i.pravatar.cc/150?img=3'
  },
  {
    id: '4',
    name: 'Lisa Branch',
    email: 'lisa@citybank.com',
    role: 'bank',
    company: 'City Bank & Trust',
    avatar: 'https://i.pravatar.cc/150?img=10'
  }
];

export const mockCases: MortgageCase[] = [
  {
    id: 'case-001',
    advisorId: '1',
    createdAt: '2023-09-15T10:30:00Z',
    status: 'open',
    loanAmount: 350000,
    dealType: 'purchase',
    financingPercentage: 80,
    borrowerIncome: 95000,
    borrowerObligations: 1200,
    loanStructure: '30-year fixed, 4.5% interest',
    interestedBanks: [],
    notes: 'First-time home buyer, excellent credit score.'
  },
  {
    id: 'case-002',
    advisorId: '2',
    createdAt: '2023-09-18T14:15:00Z',
    status: 'in_progress',
    loanAmount: 520000,
    dealType: 'refinance',
    financingPercentage: 70,
    borrowerIncome: 125000,
    borrowerObligations: 2100,
    interestedBanks: ['3'],
    notes: 'Looking to lower monthly payments, currently at 5.2%.'
  },
  {
    id: 'case-003',
    advisorId: '1',
    createdAt: '2023-09-20T09:45:00Z',
    status: 'matched',
    loanAmount: 275000,
    dealType: 'equity',
    financingPercentage: 60,
    borrowerIncome: 85000,
    borrowerObligations: 980,
    loanStructure: 'HELOC preferred',
    interestedBanks: ['3', '4'],
    notes: 'Home improvement project, property valued at $460,000.'
  },
  {
    id: 'case-004',
    advisorId: '2',
    createdAt: '2023-09-22T16:20:00Z',
    status: 'open',
    loanAmount: 720000,
    dealType: 'purchase',
    financingPercentage: 75,
    borrowerIncome: 195000,
    borrowerObligations: 3500,
    interestedBanks: [],
    notes: 'Investment property, experienced buyer with multiple properties.'
  }
];

export const mockNotifications: Notification[] = [
  {
    id: 'notif-001',
    userId: '1',
    type: 'case_interest',
    read: false,
    createdAt: '2023-09-19T10:15:00Z',
    relatedCaseId: 'case-003',
    message: 'National Banking Group has shown interest in your case'
  },
  {
    id: 'notif-002',
    userId: '3',
    type: 'new_case',
    read: true,
    createdAt: '2023-09-22T16:25:00Z',
    relatedCaseId: 'case-004',
    message: 'New mortgage case available: $720,000 purchase'
  },
  {
    id: 'notif-003',
    userId: '2',
    type: 'message',
    read: false,
    createdAt: '2023-09-19T14:30:00Z',
    relatedCaseId: 'case-002',
    message: 'Michael from National Banking Group has sent you a message'
  },
  {
    id: 'notif-004',
    userId: '4',
    type: 'new_case',
    read: false,
    createdAt: '2023-09-22T16:25:00Z',
    relatedCaseId: 'case-004',
    message: 'New mortgage case available: $720,000 purchase'
  }
];

// Function to get user data
export const getCurrentUser = (): User | null => {
  const storedUser = localStorage.getItem('currentUser');
  return storedUser ? JSON.parse(storedUser) : null;
};

// Function to simulate login
export const loginUser = (email: string, password: string): User | null => {
  // In a real app, you would validate credentials with an API
  const user = mockUsers.find(user => user.email === email);
  
  if (user) {
    // Store user in localStorage to maintain session
    localStorage.setItem('currentUser', JSON.stringify(user));
    return user;
  }
  
  return null;
};

// Function to simulate logout
export const logoutUser = (): void => {
  localStorage.removeItem('currentUser');
};

// Functions to get cases
export const getCasesByAdvisor = (advisorId: string): MortgageCase[] => {
  return mockCases.filter(c => c.advisorId === advisorId);
};

export const getOpenCasesForBanks = (): MortgageCase[] => {
  return mockCases.filter(c => c.status === 'open' || c.status === 'in_progress');
};

// Function to get notifications
export const getUserNotifications = (userId: string): Notification[] => {
  return mockNotifications.filter(n => n.userId === userId);
};
