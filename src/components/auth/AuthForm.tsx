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
  const { signIn, signUp } = useAuth();

  // ── Login state ─────────────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

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
      setLoginError(error.message);
      setLoginLoading(false);
    } else {
      // Give auth state 3 seconds to propagate, then force-reset loading
      setTimeout(() => setLoginLoading(false), 3000);
    }
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
      setRegisterError(error.message);
    } else {
      setRegisterSuccess(true);
      toast.success('ההרשמה הצליחה! בדוק את המייל שלך לאישור.');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto animated-card">
      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">התחברות</TabsTrigger>
          <TabsTrigger value="register">הרשמה</TabsTrigger>
        </TabsList>

        {/* ── LOGIN ──────────────────────────────────────────────────────────── */}
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <CardHeader>
              <CardTitle>ברוך הבא</CardTitle>
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
                <Label htmlFor="login-password">סיסמה</Label>
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
        </TabsContent>

        {/* ── REGISTER ───────────────────────────────────────────────────────── */}
        <TabsContent value="register">
          {registerSuccess ? (
            <CardContent className="py-10 text-center space-y-3">
              <div className="text-4xl">📬</div>
              <CardTitle>בדוק את המייל שלך</CardTitle>
              <CardDescription>
                שלחנו לך לינק לאישור ההרשמה. לאחר האישור תוכל להתחבר.
              </CardDescription>
            </CardContent>
          ) : (
            <form onSubmit={handleRegister}>
              <CardHeader>
                <CardTitle>יצירת חשבון</CardTitle>
                <CardDescription>בחר את סוג החשבון שלך ומלא את הפרטים</CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {registerError && <ErrorBanner message={registerError} />}

                {/* Role selection */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div
                    className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors ${selectedRole === 'advisor' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent'}`}
                    onClick={() => setSelectedRole('advisor')}
                  >
                    <Briefcase className="h-8 w-8 mb-2" />
                    <span className="font-semibold text-sm">יועץ משכנתא</span>
                  </div>
                  <div
                    className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors ${selectedRole === 'bank' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent'}`}
                    onClick={() => setSelectedRole('bank')}
                  >
                    <Building2 className="h-8 w-8 mb-2" />
                    <span className="font-semibold text-sm">בנקאי / סניף</span>
                  </div>
                </div>

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
