import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
import { useAuth } from '@/hooks/useAuth';

const getPasswordStrength = (password: string) => {
  if (!password) return null;
  if (password.length < 8) return { text: 'סיסמה חלשה מדי', color: 'text-red-500' };
  const hasLetters = /[a-zA-Zא-ת]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  if (!hasLetters || !hasNumbers) return { text: 'הוסף מספרים ואותיות', color: 'text-orange-500' };
  return { text: 'סיסמה תקינה', color: 'text-green-500' };
};

type RecoveryStatus = 'checking' | 'ready' | 'invalid';

// The password-recovery email link opens the app with a recovery token that
// Supabase turns into a PASSWORD_RECOVERY event (tracked as isPasswordRecovery in
// useAuth). We show the form ONLY in that recovery mode — a normal logged-in
// session must NOT grant access to this form. The recovery event resolves shortly
// after load, so we allow a short grace window before deciding the link is
// missing/expired. After a successful reset we sign the user out and send them to
// /login to re-authenticate with the new password.
const GRACE_MS = 3000;

const ResetPassword: React.FC = () => {
  const { updatePassword, signOut, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();

  const [graceExpired, setGraceExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setGraceExpired(true), GRACE_MS);
    return () => clearTimeout(t);
  }, []);

  // While submitting we keep showing the form: signOut() (on success) flips
  // isPasswordRecovery off, but we navigate away immediately, so don't flash the
  // "invalid" card in between.
  const status: RecoveryStatus = isPasswordRecovery || loading
    ? 'ready'
    : graceExpired
      ? 'invalid'
      : 'checking';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    const hasLetters = /[a-zA-Zא-ת]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    if (!hasLetters || !hasNumbers) {
      setError('הסיסמה חייבת להכיל מספרים ואותיות');
      return;
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(password);

    if (updateError) {
      setLoading(false);
      setError('לא ניתן לעדכן את הסיסמה. ייתכן שהקישור פג תוקף — בקש קישור חדש מדף ההתחברות.');
      return;
    }

    // Sign out of the recovery session so the user logs in fresh with the new password.
    await signOut();
    toast.success('הסיסמה עודכנה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.');
    navigate('/login', { replace: true });
  };

  const strength = getPasswordStrength(password);

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md mx-auto">
        {status === 'checking' ? (
          <CardContent className="py-16 flex justify-center">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </CardContent>
        ) : status === 'invalid' ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">הקישור אינו תקף</CardTitle>
              <CardDescription>
                קישור איפוס הסיסמה חסר או שפג תוקפו. ניתן לבקש קישור חדש מדף ההתחברות.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
                חזרה להתחברות
              </Button>
            </CardFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-2xl">בחירת סיסמה חדשה</CardTitle>
              <CardDescription>הזן סיסמה חדשה לחשבונך</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password">סיסמה חדשה</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="לפחות 8 תווים"
                />
                {strength && (
                  <p className={`text-xs font-medium ${strength.color}`}>{strength.text}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">אימות סיסמה</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'מעדכן…' : 'עדכן סיסמה'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;
