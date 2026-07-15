import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, HandshakeIcon, LockIcon } from 'lucide-react';
import type { DbCase, CaseStatus } from '@/types/cases';

// ─── Case status ──────────────────────────────────────────────────────────────
// Status colors are intentionally literal (not theme tokens): blue=open,
// amber=in-progress, green=matched, gray=closed, red=rejected.

const STATUS_COLOR: Record<CaseStatus, string> = {
  open: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
  matched: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
  closed: 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20',
  rejected: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
};

const STATUS_ICON: Record<CaseStatus, React.ReactNode> = {
  open: <AlertCircle className="h-4 w-4 ml-1" />,
  in_progress: <Clock className="h-4 w-4 ml-1" />,
  matched: <HandshakeIcon className="h-4 w-4 ml-1" />,
  closed: <LockIcon className="h-4 w-4 ml-1" />,
  rejected: <AlertCircle className="h-4 w-4 ml-1" />,
};

const STATUS_LABEL: Record<CaseStatus, string> = {
  open: 'פתוח',
  in_progress: 'בטיפול',
  matched: 'הותאם',
  closed: 'סגור',
  rejected: 'נדחה',
};

export const CaseStatusBadge: React.FC<{ status: CaseStatus }> = ({ status }) => (
  <Badge className={`flex items-center ${STATUS_COLOR[status]}`}>
    {STATUS_ICON[status]}
    {STATUS_LABEL[status]}
  </Badge>
);

// ─── Approval / lifecycle badge for a case row ────────────────────────────────

export const ApprovalBadge: React.FC<{ c: DbCase }> = ({ c }) => {
  const status = c.status as string;
  if (status === 'closed') {
    return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">עסקה נסגרה</Badge>;
  }
  if (status === 'rejected') {
    return <Badge className="bg-red-500/10 text-red-600 border-red-200">נדחה</Badge>;
  }
  if (c.is_approved && status === 'open') {
    return <Badge className="bg-green-500/10 text-green-600 border-green-200">פעיל - חשוף לבנקאים</Badge>;
  }
  if (!c.is_approved && status !== 'rejected') {
    return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">ממתין לאישור Admin</Badge>;
  }
  return null;
};

// ─── Match score badge ────────────────────────────────────────────────────────
// Thresholds mirror the matching engine: pairs below SCORE_MIN never become
// matches (run_matching_for_case filters at 40).

export const SCORE_HIGH = 70;
export const SCORE_MIN = 40;

export const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  let color = 'bg-red-500/10 text-red-500 border-red-500/20';
  if (score >= SCORE_HIGH) color = 'bg-green-500/10 text-green-500 border-green-500/20';
  else if (score >= SCORE_MIN) color = 'border-amber-500/20 bg-amber-500/10 text-amber-500';

  return (
    <Badge variant="outline" className={`font-mono text-sm px-2 py-1 ${color}`}>
      {score}% התאמה
    </Badge>
  );
};
