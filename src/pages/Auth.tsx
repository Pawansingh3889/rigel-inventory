import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Captcha from '@/components/ui/captcha';

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PasswordStrength } from '@/components/ui/password-strength';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Building2, Phone, MapPin } from 'lucide-react';

export default function Auth() {
  const { user, signIn, signUp, resetPassword, loading, checkExistingUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showExistingUserDialog, setShowExistingUserDialog] = useState(false);
  const [existingUserMessage, setExistingUserMessage] = useState('');
  const [searchParams] = useSearchParams();
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
  const defaultTab = searchParams.get('tab') || 'signin';

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    await signIn(email, password);
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const companyName = formData.get('companyName') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phone = formData.get('phone') as string;
    const city = formData.get('city') as string;
    const state = formData.get('state') as string;
    const country = formData.get('country') as string;
    
    // Validate passwords match
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      setIsLoading(false);
      return;
    }
    
    // Validate phone number (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
      alert('Phone number must be exactly 10 digits');
      setIsLoading(false);
      return;
    }
    
    // Check for existing user/company
    const { emailExists, companyExists } = await checkExistingUser(email, companyName);
    
    if (emailExists || companyExists) {
      let message = 'Account already exists:\n';
      if (emailExists) message += '• Email address is already registered\n';
      if (companyExists) message += '• Company name is already taken\n';
      message += 'Please use different credentials or sign in to your existing account.';
      
      setExistingUserMessage(message);
      setShowExistingUserDialog(true);
      setIsLoading(false);
      return;
    }
    
    const result = await signUp(email, password, companyName, firstName, lastName, phone, city, state, country);
    
    if (!result.error) {
      // User account created successfully, they will be automatically signed in
      // Navigate to dashboard
      window.location.href = '/dashboard';
    }
    
    setIsLoading(false);
  };


  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('reset-email') as string;
    
    await resetPassword(email);
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Building2 className="h-8 w-8 text-primary mr-2" />
          <h1 className="text-2xl font-bold">PRISM ERP</h1>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="forgot">Reset Password</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <Card>
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>
                  Sign in to your account to access your ERP dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                  
                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const tabs = document.querySelector('[value="forgot"]') as HTMLElement;
                        tabs?.click();
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>Create your account</CardTitle>
                <CardDescription>
                  Set up your company workspace and start managing your business
                </CardDescription>
              </CardHeader>
              <CardContent>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-company">Company Name</Label>
                      <Input
                        id="signup-company"
                        name="companyName"
                        type="text"
                        placeholder="Your Company Ltd."
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-firstname">First Name</Label>
                        <Input
                          id="signup-firstname"
                          name="firstName"
                          type="text"
                          placeholder="John"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-lastname">Last Name</Label>
                        <Input
                          id="signup-lastname"
                          name="lastName"
                          type="text"
                          placeholder="Doe"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone Number (10 digits)
                      </Label>
                      <Input
                        id="signup-phone"
                        name="phone"
                        type="tel"
                        placeholder="1234567890"
                        pattern="\d{10}"
                        maxLength={10}
                        required
                        title="Please enter exactly 10 digits"
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location Details
                      </Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-city">City</Label>
                          <Input
                            id="signup-city"
                            name="city"
                            type="text"
                            placeholder="New York"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-state">State</Label>
                          <Input
                            id="signup-state"
                            name="state"
                            type="text"
                            placeholder="NY"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-country">Country</Label>
                        <Input
                          id="signup-country"
                          name="country"
                          type="text"
                          placeholder="United States"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <PasswordStrength password={password} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-sm text-destructive">Passwords do not match</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forgot">
            <Card>
              <CardHeader>
                <CardTitle>Reset your password</CardTitle>
                <CardDescription>
                  Enter your email address and we'll send you a link to reset your password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      name="reset-email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending reset link...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                  
                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const tabs = document.querySelector('[value="signin"]') as HTMLElement;
                        tabs?.click();
                      }}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      Back to sign in
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={showExistingUserDialog} onOpenChange={setShowExistingUserDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account Already Exists</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {existingUserMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowExistingUserDialog(false)}>
              Understood
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}