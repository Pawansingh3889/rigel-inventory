import { useState, useEffect } from 'react';
import { Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordStrength } from '@/components/ui/password-strength';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Building2, Mail, Lock, Eye, EyeOff, Shield, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { emailSchema, passwordSchema, nameSchema } from '@/lib/security';
import Captcha from '@/components/ui/captcha';

export default function EnhancedAuth() {
  const { user, signIn, signUp, resetPassword, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { toast } = useToast();

  // Get initial tab from URL params or location state
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const tabFromState = location.state?.tab;
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    } else if (tabFromState) {
      setActiveTab(tabFromState);
    }
  }, [searchParams, location.state]);

  // Show success message from business registration
  useEffect(() => {
    if (location.state?.message) {
      toast({
        title: "Success!",
        description: location.state.message,
        duration: 5000,
      });
    }
  }, [location.state, toast]);

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
    
    const result = await signIn(email, password, captchaToken);
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
    
    // Enhanced validation using security schemas
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      nameSchema.parse(companyName);
      nameSchema.parse(firstName);
      nameSchema.parse(lastName);
      nameSchema.parse(city);
      nameSchema.parse(state);
      nameSchema.parse(country);
    } catch (validationError: any) {
      toast({
        title: "Validation failed",
        description: validationError.errors?.[0]?.message || "Please check your input",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    // Validate passwords match
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    // Validate phone number (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
      toast({
        title: "Invalid phone number",
        description: "Phone number must be exactly 10 digits",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    const result = await signUp(email, password, companyName, firstName, lastName, phone, city, state, country);
    
    if (!result?.error) {
      // Successfully signed up, redirect will happen from useEffect
      return;
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">PRISM ERP</h1>
              <p className="text-sm text-muted-foreground">Business Management Platform</p>
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Secure Login • 256-bit SSL Encryption</span>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="signin" className="text-sm">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="text-sm">Sign Up</TabsTrigger>
            <TabsTrigger value="forgot" className="text-sm">Reset</TabsTrigger>
          </TabsList>
          
          {/* Sign In Tab */}
          <TabsContent value="signin">
            <Card className="shadow-elevated border-0">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl">Welcome back</CardTitle>
                <CardDescription className="text-base">
                  Sign in to your account to access your ERP dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-sm font-medium">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10 h-12"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="pl-10 pr-10 h-12"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <Captcha onVerify={(t) => setCaptchaToken(t)} />
                  <Button type="submit" className="w-full h-12 btn-gradient text-base" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                  
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('forgot')}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Sign Up Tab */}
          <TabsContent value="signup">
            <Card className="shadow-elevated border-0">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl">Create your account</CardTitle>
                <CardDescription className="text-base">
                  Set up your company workspace and start managing your business
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-company" className="text-sm font-medium">Company Name</Label>
                    <Input
                      id="signup-company"
                      name="companyName"
                      type="text"
                      placeholder="Your Company Ltd."
                      className="h-12"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname" className="text-sm font-medium">First Name</Label>
                      <Input
                        id="signup-firstname"
                        name="firstName"
                        type="text"
                        placeholder="John"
                        className="h-12"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname" className="text-sm font-medium">Last Name</Label>
                      <Input
                        id="signup-lastname"
                        name="lastName"
                        type="text"
                        placeholder="Doe"
                        className="h-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10 h-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone" className="text-sm font-medium">Phone Number</Label>
                    <Input
                      id="signup-phone"
                      name="phone"
                      type="tel"
                      placeholder="1234567890"
                      pattern="\d{10}"
                      maxLength={10}
                      className="h-12"
                      required
                      title="Please enter exactly 10 digits"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-city" className="text-sm font-medium">City</Label>
                      <Input
                        id="signup-city"
                        name="city"
                        type="text"
                        placeholder="New York"
                        className="h-12"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-state" className="text-sm font-medium">State</Label>
                      <Input
                        id="signup-state"
                        name="state"
                        type="text"
                        placeholder="NY"
                        className="h-12"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-country" className="text-sm font-medium">Country</Label>
                    <Input
                      id="signup-country"
                      name="country"
                      type="text"
                      placeholder="United States"
                      className="h-12"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-12"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrength password={password} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10 h-12"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-sm text-destructive">Passwords do not match</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-12 btn-gradient text-base" disabled={isLoading}>
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

          {/* Forgot Password Tab */}
          <TabsContent value="forgot">
            <Card className="shadow-elevated border-0">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl">Reset your password</CardTitle>
                <CardDescription className="text-base">
                  Enter your email address and we'll send you a link to reset your password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm font-medium">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        name="reset-email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10 h-12"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full h-12 btn-gradient text-base" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending reset link...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                  
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('signin')}
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

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-muted-foreground">
          <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}