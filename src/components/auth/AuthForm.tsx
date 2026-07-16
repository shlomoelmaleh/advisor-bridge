import React, { useState } from 'react';
import { Briefcase, Building2 } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface AuthFormProps {
  defaultTab?: 'login' | 'register';
}

const getPasswordStrength = (password: string) => {
  if (!password) return null;
  if (password.length < 8) return { text: 'סיסמה חלשה מדי', color: 'text-red-500' };
  const hasLetters = /[a-zA-Zא-ת]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  if (!hasLetters || !hasNumbers) return { text: 'הוסף מספרים ואותיות', color: 'text-orange-500' };
  return { text: 'סיסמה תקינה', color: 'text-green-500' };
};

// ─── Error banner ─────────────────────────────────────────────────────────────
const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
    {message}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const AuthForm: React.FC<AuthFormProps> = ({ defaultTab = 'login' }) => {
  const { signIn, signUp, resetPassword } = useAuth();

  // ── Login state ─────────────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // ── Forgot-password state (inline within the login tab) ──────────────────────
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // ── Register state ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'advisor' | 'bank'>('advisor');

  // ── Sign in ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      setLoginError('אימייל או סיסמה שגויים');
      setLoginLoading(false);
      return;
    }

    // signIn succeeded. onAuthStateChange will fire, updating auth status.
    // RootRoute will see status change to 'ready' and redirect to dashboard.
    // No navigate() needed — we're already on '/' and RootRoute handles it.
    setLoginLoading(false);
  };

  // ── Forgot password ───────────────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    // Fire-and-forget: always show the same confirmation, regardless of whether
    // the address exists, so we never reveal which emails are registered.
    await resetPassword(forgotEmail);
    setForgotLoading(false);
    setForgotSent(true);
  };

  // ── Sign up ──────────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (!fullName.trim()) {
      setRegisterError('נא להזין שם מלא');
      return;
    }
    if (registerPassword !== registerConfirm) {
      setRegisterError('הסיסמאות אינן תואמות');
      return;
    }
    if (registerPassword.length < 8) {
      setRegisterError('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    const hasLetters = /[a-zA-Zא-ת]/.test(registerPassword);
    const hasNumbers = /[0-9]/.test(registerPassword);
    if (!hasLetters || !hasNumbers) {
      setRegisterError('הסיסמה חייבת להכיל מספרים ואותיות');
      return;
    }

    setRegisterLoading(true);

    const { error } = await signUp(
      registerEmail,
      registerPassword,
      fullName.trim(),
      selectedRole,
      company.trim() || undefined
    );

    setRegisterLoading(false);

    if (error) {
      setRegisterError('ההרשמה נכשלה. נסה שוב או פנה לתמיכה.');
    } else {
      setRegisterSuccess(true);
      toast.success('ההרשמה הצליחה! בדוק את המייל שלך לאישור.');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto animated-card">
      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">התחברות</TabsTrigger>
          <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">הרשמה</TabsTrigger>
        </TabsList>

        {/* ── LOGIN ──────────────────────────────────────────────────────────── */}
        <TabsContent value="login">
          {showForgot ? (
            forgotSent ? (
              <CardContent className="py-10 text-center space-y-3">
                <div className="text-4xl">📧</div>
                <h2 className="text-2xl font-semibold leading-none tracking-tight">בדוק את המייל שלך</h2>
                <CardDescription>
                  אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס הסיסמה. הקישור תקף לזמן מוגבל.
                </CardDescription>
                <Button
                  variant="ghost"
                  className="mt-2"
                  onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                >
                  חזרה להתחברות
                </Button>
              </CardContent>
            ) : (
              <form onSubmit={handleForgot}>
                <CardHeader>
                  <h2 className="text-2xl font-semibold leading-none tracking-tight">איפוס סיסמה</h2>
                  <CardDescription>הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">אימייל</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="name@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex-col gap-2">
                  <Button type="submit" className="w-full" disabled={forgotLoading}>
                    {forgotLoading ? 'שולח…' : 'שלח קישור לאיפוס'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowForgot(false)}
                  >
                    חזרה להתחברות
                  </Button>
                </CardFooter>
              </form>
            )
          ) : (
          <form onSubmit={handleLogin}>
            <CardHeader>
              <h2 className="text-2xl font-semibold leading-none tracking-tight">ברוך הבא</h2>
              <CardDescription>הזן את פרטיך כדי להתחבר לחשבונך</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {loginError && <ErrorBanner message={loginError} />}

              <div className="space-y-2">
                <Label htmlFor="login-email">אימייל</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">סיסמה</Label>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setForgotEmail(loginEmail); }}
                    className="text-xs text-primary hover:underline"
                  >
                    שכחת סיסמה?
                  </button>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? 'מתחבר…' : 'התחבר'}
              </Button>
            </CardFooter>
          </form>
          )}
        </TabsContent>

        {/* ── REGISTER ───────────────────────────────────────────────────────── */}
        <TabsContent value="register">
          {registerSuccess ? (
            <CardContent className="py-10 text-center space-y-3">
              <div className="text-4xl">📬</div>
              <h2 className="text-2xl font-semibold leading-none tracking-tight">בדוק את המייל שלך</h2>
              <CardDescription>
                שלחנו לך לינק לאישור ההרשמה. לאחר האישור תוכל להתחבר.
              </CardDescription>
            </CardContent>
          ) : (
            <form onSubmit={handleRegister}>
              <CardHeader>
                <h2 className="text-2xl font-semibold leading-none tracking-tight">יצירת חשבון</h2>
                <CardDescription>בחר את סוג החשבון שלך ומלא את הפרטים</CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {registerError && <ErrorBanner message={registerError} />}

                {/* Role selection — accessible radio group (keyboard + screen readers) */}
                <fieldset className="mb-4">
                  <legend className="text-sm font-medium mb-2">סוג חשבון</legend>
                  <RadioGroup
                    value={selectedRole}
                    onValueChange={(v) => setSelectedRole(v as 'advisor' | 'bank')}
                    className="grid grid-cols-2 gap-4"
                  >
                    <Label
                      htmlFor="role-advisor"
                      className="flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors border-border bg-card hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                    >
                      <RadioGroupItem id="role-advisor" value="advisor" className="sr-only" />
                      <Briefcase className="h-8 w-8 mb-2" />
                      <span className="font-semibold text-sm">יועץ משכנתא</span>
                    </Label>
                    <Label
                      htmlFor="role-bank"
                      className="flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors border-border bg-card hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                    >
                      <RadioGroupItem id="role-bank" value="bank" className="sr-only" />
                      <Building2 className="h-8 w-8 mb-2" />
                      <span className="font-semibold text-sm">בנקאי / סניף</span>
                    </Label>
                  </RadioGroup>
                </fieldset>

                {/* Full name */}
                <div className="space-y-2">
                  <Label htmlFor="reg-name">שם מלא</Label>
                  <Input
                    id="reg-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ישראל ישראלי"
                    required
                    autoComplete="name"
                  />
                </div>

                {/* Company (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="reg-company">
                    חברה / סניף{' '}
                    <span className="text-muted-foreground text-xs">(אופציונלי)</span>
                  </Label>
                  <Input
                    id="reg-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="שם משרד הייעוץ"
                    autoComplete="organization"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="reg-email">אימייל</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    autoComplete="email"
                  />
                </div>

                {/* Password */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">סיסמה</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="לפחות 8 תווים"
                    />
                    {registerPassword && (
                      <p className={`text-xs font-medium ${getPasswordStrength(registerPassword)?.color}`}>
                        {getPasswordStrength(registerPassword)?.text}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">אימות סיסמה</Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      value={registerConfirm}
                      onChange={(e) => setRegisterConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <Button type="submit" className="w-full" disabled={registerLoading}>
                  {registerLoading ? 'יוצר חשבון…' : 'צור חשבון'}
                </Button>
              </CardFooter>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default AuthForm;
