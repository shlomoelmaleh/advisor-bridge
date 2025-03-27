
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { loginUser } from '@/lib/mockData';
import { UserRole } from '@/types';

interface AuthFormProps {
  defaultTab?: 'login' | 'register';
}

const AuthForm: React.FC<AuthFormProps> = ({ defaultTab = 'login' }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'login' | 'register'>(defaultTab);

  // Login form state
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');

  // Register form state
  const [registerName, setRegisterName] = React.useState('');
  const [registerEmail, setRegisterEmail] = React.useState('');
  const [registerPassword, setRegisterPassword] = React.useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = React.useState('');
  const [registerCompany, setRegisterCompany] = React.useState('');
  const [registerRole, setRegisterRole] = React.useState<UserRole>('advisor');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      // Mock login logic - in a real app this would call an API
      const user = loginUser(loginEmail, loginPassword);
      
      if (user) {
        toast.success('התחברות הצליחה!');
        
        // Redirect based on user role
        if (user.role === 'advisor') {
          navigate('/advisor/dashboard');
        } else {
          navigate('/bank/dashboard');
        }
      } else {
        toast.error('פרטים שגויים');
      }
      
      setIsLoading(false);
    }, 1000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate passwords match
    if (registerPassword !== registerConfirmPassword) {
      toast.error('הסיסמאות אינן תואמות');
      setIsLoading(false);
      return;
    }

    // Simulate API call
    setTimeout(() => {
      // In a real app, this would make an API call to register the user
      toast.success('החשבון נוצר בהצלחה!');
      setActiveTab('login');
      setIsLoading(false);
    }, 1000);
  };

  // For demo purposes, let's provide some test credentials
  const setDemoCredentials = (role: UserRole) => {
    if (role === 'advisor') {
      setLoginEmail('john@advisorgroup.com');
      setLoginPassword('password');
    } else {
      setLoginEmail('michael@nationalbank.com');
      setLoginPassword('password');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto animated-card">
      <Tabs defaultValue={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'register')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">התחברות</TabsTrigger>
          <TabsTrigger value="register">הרשמה</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <CardHeader>
              <CardTitle>התחברות לחשבון שלך</CardTitle>
              <CardDescription>
                הזן את פרטי הכניסה שלך כדי לגשת לחשבון שלך
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">דוא"ל</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">סיסמה</Label>
                  <a 
                    href="#" 
                    className="text-xs text-primary hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.info('תכונת איפוס סיסמה תהיה זמינה בגרסת הייצור.');
                    }}
                  >
                    שכחת סיסמה?
                  </a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'מתחבר...' : 'התחבר'}
              </Button>
              <div className="flex justify-center space-x-4 w-full">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setDemoCredentials('advisor')}
                >
                  הדגמת יועץ
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setDemoCredentials('bank')}
                >
                  הדגמת בנק
                </Button>
              </div>
            </CardFooter>
          </form>
        </TabsContent>
        
        <TabsContent value="register">
          <form onSubmit={handleRegister}>
            <CardHeader>
              <CardTitle>יצירת חשבון</CardTitle>
              <CardDescription>
                הזן את המידע שלך כדי ליצור את החשבון שלך
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">סוג חשבון</Label>
                <Select 
                  value={registerRole} 
                  onValueChange={(value: string) => setRegisterRole(value as UserRole)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוג חשבון" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advisor">יועץ משכנתאות</SelectItem>
                    <SelectItem value="bank">נציג בנק</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">שם מלא</Label>
                <Input 
                  id="name" 
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="ישראל ישראלי" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">חברה</Label>
                <Input 
                  id="company" 
                  value={registerCompany}
                  onChange={(e) => setRegisterCompany(e.target.value)}
                  placeholder="שם החברה שלך" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">דוא"ל</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="name@example.com" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">אימות סיסמה</Label>
                <Input 
                  id="confirm" 
                  type="password" 
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  required 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'יוצר חשבון...' : 'צור חשבון'}
              </Button>
            </CardFooter>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default AuthForm;
