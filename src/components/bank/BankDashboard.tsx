import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useAppetites } from '@/hooks/useAppetites';
import type { AppetiteLevel, UpsertAppetiteData } from '@/types/appetites';
import type { DbCase } from '@/types/cases';

const fmt = (n: number) => `₪${(n / 1_000).toLocaleString()}K`;

// ─── Appetite Form ────────────────────────────────────────────────────────────

const AppetiteForm: React.FC<{
  initialData?: UpsertAppetiteData;
  onSubmit: (data: UpsertAppetiteData) => Promise<void>;
  onCancel?: () => void;
}> = ({ initialData, onSubmit, onCancel }) => {
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bankName, setBankName] = useState(initialData?.bank_name || profile?.company || '');
  const [branchName, setBranchName] = useState(initialData?.branch_name || '');
  const [level, setLevel] = useState<AppetiteLevel>(initialData?.appetite_level || 'medium');
  const [minAmount, setMinAmount] = useState(initialData?.min_loan_amount || 500_000);
  const [maxLtv, setMaxLtv] = useState(initialData?.max_ltv || 75);
  const [slaDays, setSlaDays] = useState(initialData?.sla_days || 14);

  // Default to 1 month from now
  const [validUntil, setValidUntil] = useState(
    initialData?.valid_until ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const [borrowerTypes, setBorrowerTypes] = useState<string[]>(
    initialData?.preferred_borrower_types || ['employee', 'self_employed']
  );
  const [regions, setRegions] = useState<string[]>(
    initialData?.preferred_regions || ['center', 'tel_aviv']
  );

  const toggleArray = (arr: string[], setArr: (a: string[]) => void, item: string) => {
    if (arr.includes(item)) setArr(arr.filter((i) => i !== item));
    else setArr([...arr, item]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) {
      toast.error('שם הבנק הוא שדה חובה');
      return;
    }

    setIsSubmitting(true);
    await onSubmit({
      bank_name: bankName,
      branch_name: branchName,
      appetite_level: level,
      min_loan_amount: minAmount,
      max_ltv: maxLtv,
      preferred_borrower_types: borrowerTypes,
      preferred_regions: regions,
      sla_days: slaDays,
      valid_until: validUntil,
    });
    setIsSubmitting(false);
  };

  const levelStyles = {
    high: 'border-green-500 bg-green-50 text-green-700',
    medium: 'border-amber-500 bg-amber-50 text-amber-700',
    low: 'border-red-500 bg-red-50 text-red-700',
  };

  return (
    <Card className="animated-card mb-8">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>אות תיאבון (Appetite Signal)</CardTitle>
          <CardDescription>
            הגדר אילו סוגי תיקים מעניינים את הסניף שלך כרגע
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">שם הבנק *</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="לדוגמה: מזרחי טפחות"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchName">שם הסניף</Label>
              <Input
                id="branchName"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="לדוגמה: סניף תל אביב ראשי"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>רמת תיאבון לתיקים חדשים</Label>
            <div className="flex gap-3">
              {[
                { val: 'low', label: '🔴 נמוך', desc: 'עומס גבוה, רק תיקים מצוינים' },
                { val: 'medium', label: '🟡 בינוני', desc: 'קולט תיקים רגיל' },
                { val: 'high', label: '🟢 גבוה', desc: 'רעב לתיקים, מבצעים כרגע' },
              ].map((btn) => {
                const isSelected = level === btn.val;
                return (
                  <button
                    key={btn.val}
                    type="button"
                    onClick={() => setLevel(btn.val as AppetiteLevel)}
                    className={`flex-1 rounded-lg border-2 p-3 text-right transition-all ${isSelected ? levelStyles[btn.val as AppetiteLevel] : 'border-border'
                      }`}
                  >
                    <div className="font-semibold">{btn.label}</div>
                    <div className="text-xs mt-1 text-muted-foreground">{btn.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>משכנתא מינימלית</Label>
                <span className="text-sm">₪{minAmount.toLocaleString()}</span>
              </div>
              <Slider
                min={100_000}
                max={3_000_000}
                step={50_000}
                value={[minAmount]}
                onValueChange={([v]) => setMinAmount(v)}
              />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>אחוז מימון מקסימלי (LTV)</Label>
                <span className="text-sm">{maxLtv}%</span>
              </div>
              <Slider
                min={30}
                max={95}
                step={5}
                value={[maxLtv]}
                onValueChange={([v]) => setMaxLtv(v)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>סוג לווה מועדף</Label>
            <div className="flex gap-4">
              {[
                { id: 'employee', label: 'שכיר' },
                { id: 'self_employed', label: 'עצמאי' },
              ].map((bt) => (
                <div key={bt.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`bt-${bt.id}`}
                    checked={borrowerTypes.includes(bt.id)}
                    onCheckedChange={() => toggleArray(borrowerTypes, setBorrowerTypes, bt.id)}
                  />
                  <Label htmlFor={`bt-${bt.id}`} className="cursor-pointer font-normal">
                    {bt.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>אזורים רלוונטיים</Label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { id: 'tel_aviv', label: 'תל אביב' },
                { id: 'center', label: 'מרכז' },
                { id: 'sharon', label: 'שרון' },
                { id: 'shfela', label: 'שפלה' },
                { id: 'jerusalem', label: 'ירושלים' },
                { id: 'north', label: 'צפון' },
                { id: 'south', label: 'דרום' },
              ].map((reg) => (
                <div key={reg.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`reg-${reg.id}`}
                    checked={regions.includes(reg.id)}
                    onCheckedChange={() => toggleArray(regions, setRegions, reg.id)}
                  />
                  <Label htmlFor={`reg-${reg.id}`} className="cursor-pointer text-xs font-normal">
                    {reg.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slaDays">ימי טיפול מקסימום (SLA)</Label>
              <Input
                id="slaDays"
                type="number"
                min={1}
                max={60}
                value={slaDays}
                onChange={(e) => setSlaDays(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validUntil">בתוקף עד</Label>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              ביטול
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'שומר…' : 'פרסם אות תיאבון'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

// ─── Open cases row ───────────────────────────────────────────────────────────

const AnonymousCaseRow: React.FC<{ c: DbCase }> = ({ c }) => (
  <div className="p-4 border rounded-lg hover:bg-accent transition-colors card-highlight">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg text-primary">
            {fmt(c.loan_amount_min)} – {fmt(c.loan_amount_max)}
          </h3>
          <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">פתוח</Badge>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline">LTV {c.ltv}%</Badge>
          <Badge variant="outline">
            {c.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'}
          </Badge>
          <Badge variant="outline">{c.region}</Badge>
        </div>
      </div>
      <div>
        <Button variant="secondary" size="sm">
          הצע התאמה (בקרוב)
        </Button>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const BankDashboard = () => {
  const { profile } = useAuth();
  const { myAppetite, openCases, loading, error, upsertAppetite } = useAppetites();
  const [isEditingAppetite, setIsEditingAppetite] = useState(false);

  if (profile && profile.is_approved === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-5xl">⏳</div>
          <h2 className="text-2xl font-bold">ממתין לאישור</h2>
          <p className="text-muted-foreground">
            החשבון שלך נמצא בבדיקה. מנהל המערכת יאשר אותך בקרוב.
          </p>
        </div>
      </div>
    );
  }

  const handleAppetiteSubmit = async (data: UpsertAppetiteData) => {
    const { error: upsertError } = await upsertAppetite(data);
    if (upsertError) {
      toast.error(`שגיאה בשמירה: ${upsertError}`);
    } else {
      toast.success('אות התיאבון עודכן בהצלחה!');
      setIsEditingAppetite(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500 bg-red-50 rounded-lg">שגיאה: {error}</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">אזור בנקאים</h1>
        <p className="text-muted-foreground">
          שלום {profile?.full_name}, כאן תוכל לפרסם את אות התיאבון של הסניף ולצפות בתיקים.
        </p>
      </div>

      {/* SECTION 1: Appetite Signal */}
      {!myAppetite || isEditingAppetite ? (
        <AppetiteForm
          initialData={myAppetite || undefined}
          onSubmit={handleAppetiteSubmit}
          onCancel={myAppetite ? () => setIsEditingAppetite(false) : undefined}
        />
      ) : (
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  אות תיאבון פעיל
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    {myAppetite.appetite_level === 'high' && '🟢 גבוה'}
                    {myAppetite.appetite_level === 'medium' && '🟡 בינוני'}
                    {myAppetite.appetite_level === 'low' && '🔴 נמוך'}
                  </Badge>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {myAppetite.bank_name} {myAppetite.branch_name ? `- ${myAppetite.branch_name}` : ''}
                </p>
                <div className="flex gap-3 mt-4 text-sm">
                  <span>מינימום: <strong>₪{myAppetite.min_loan_amount.toLocaleString()}</strong></span>
                  <span>|</span>
                  <span>LTV מקסימלי: <strong>{myAppetite.max_ltv}%</strong></span>
                  <span>|</span>
                  <span>SLA: <strong>{myAppetite.sla_days} ימים</strong></span>
                </div>
              </div>
              <Button variant="outline" onClick={() => setIsEditingAppetite(true)}>
                עדכן טיאבון
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: Open Cases */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          תיקים פתוחים והזדמנויות <Badge>{openCases.length}</Badge>
        </h2>

        {openCases.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg bg-background">
            <h3 className="text-lg font-medium text-muted-foreground mb-1">
              אין תיקים פתוחים כרגע
            </h3>
            <p className="text-sm text-muted-foreground opacity-80">
              יועצי משכנתאות עדיין לא העלו תיקים שממתינים לטיפול
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {openCases.map(c => (
              <AnonymousCaseRow key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BankDashboard;
