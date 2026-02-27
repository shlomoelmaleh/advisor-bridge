import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useCases } from '@/hooks/useCases';
import type { BorrowerType } from '@/types/cases';

const CaseForm = () => {
  const navigate = useNavigate();
  const { createCase } = useCases();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [loanAmountMin, setLoanAmountMin] = useState(800_000);
  const [loanAmountMax, setLoanAmountMax] = useState(1_500_000);
  const [ltv, setLtv] = useState(75);
  const [borrowerType, setBorrowerType] = useState<BorrowerType>('employee');
  const [propertyType, setPropertyType] = useState('apartment');
  const [region, setRegion] = useState('center');

  // Priorities
  const [prioritySpeed, setPrioritySpeed] = useState(false);
  const [priorityRate, setPriorityRate] = useState(false);
  const [priorityLtv, setPriorityLtv] = useState(false);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loanAmountMin > loanAmountMax) {
      toast.error('סכום מינימלי לא יכול להיות גדול ממקסימלי');
      return;
    }

    setIsSubmitting(true);

    const { error } = await createCase({
      loan_amount_min: loanAmountMin,
      loan_amount_max: loanAmountMax,
      ltv,
      borrower_type: borrowerType,
      property_type: propertyType,
      region,
      priorities: {
        speed: prioritySpeed,
        rate: priorityRate,
        ltv: priorityLtv,
      },
      is_anonymous: true,
    });

    setIsSubmitting(false);

    if (error) {
      toast.error(`שגיאה בהגשת התיק: ${error}`);
    } else {
      toast.success('התיק הוגש בהצלחה!');
      navigate('/advisor/dashboard');
    }
  };

  return (
    <Card className="max-w-3xl mx-auto animated-card">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>הגשת תיק משכנתא חדש</CardTitle>
          <CardDescription>
            מלא את הפרטים — התיק יוצג לסניפים באופן אנונימי
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* ── Loan amount range ─────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>טווח סכום המשכנתא</Label>
              <span className="text-sm text-muted-foreground">
                ₪{loanAmountMin.toLocaleString()} – ₪{loanAmountMax.toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="amountMin" className="text-xs text-muted-foreground">
                  מינימום
                </Label>
                <Slider
                  id="amountMin"
                  min={100_000}
                  max={5_000_000}
                  step={50_000}
                  value={[loanAmountMin]}
                  onValueChange={([v]) => setLoanAmountMin(v)}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>₪100K</span>
                  <span>₪5M</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="amountMax" className="text-xs text-muted-foreground">
                  מקסימום
                </Label>
                <Slider
                  id="amountMax"
                  min={100_000}
                  max={5_000_000}
                  step={50_000}
                  value={[loanAmountMax]}
                  onValueChange={([v]) => setLoanAmountMax(v)}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>₪100K</span>
                  <span>₪5M</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── LTV ──────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="ltv">אחוז מימון (LTV)</Label>
              <span className="font-semibold text-lg">{ltv}%</span>
            </div>
            <Slider
              id="ltv"
              min={10}
              max={95}
              step={5}
              value={[ltv]}
              onValueChange={([v]) => setLtv(v)}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10%</span>
              <span>95%</span>
            </div>
          </div>

          {/* ── Borrower type + Property type + Region ───────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="borrowerType">סוג לווה</Label>
              <Select
                value={borrowerType}
                onValueChange={(v) => setBorrowerType(v as BorrowerType)}
              >
                <SelectTrigger id="borrowerType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">שכיר</SelectItem>
                  <SelectItem value="self_employed">עצמאי</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyType">סוג נכס</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger id="propertyType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartment">דירה</SelectItem>
                  <SelectItem value="private_house">בית פרטי</SelectItem>
                  <SelectItem value="penthouse">פנטהאוז</SelectItem>
                  <SelectItem value="commercial">מסחרי</SelectItem>
                  <SelectItem value="land">קרקע</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">אזור</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger id="region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">מרכז</SelectItem>
                  <SelectItem value="tel_aviv">תל אביב</SelectItem>
                  <SelectItem value="jerusalem">ירושלים</SelectItem>
                  <SelectItem value="north">צפון</SelectItem>
                  <SelectItem value="south">דרום</SelectItem>
                  <SelectItem value="sharon">שרון</SelectItem>
                  <SelectItem value="shfela">שפלה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Priorities ────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <Label>עדיפויות הלקוח</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              מה חשוב ללקוח? (ניתן לסמן כמה)
            </p>
            <div className="flex flex-wrap gap-6">
              {[
                { id: 'speed', label: 'מהירות אישור', checked: prioritySpeed, set: setPrioritySpeed },
                { id: 'rate', label: 'ריבית נמוכה', checked: priorityRate, set: setPriorityRate },
                { id: 'ltv', label: 'אחוז מימון גבוה', checked: priorityLtv, set: setPriorityLtv },
              ].map(({ id, label, checked, set }) => (
                <div key={id} className="flex items-center gap-2">
                  <Checkbox
                    id={`priority-${id}`}
                    checked={checked}
                    onCheckedChange={(val) => set(val === true)}
                  />
                  <Label htmlFor={`priority-${id}`} className="cursor-pointer font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/advisor/dashboard')}
            disabled={isSubmitting}
          >
            ביטול
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'שולח…' : 'הגשת תיק'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default CaseForm;
