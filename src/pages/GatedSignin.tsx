import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  LogIn, 
  Building2,
  User,
  Lock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const GatedSignin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessRefNo: '',
    username: '',
    password: ''
  });

  const message = location.state?.message;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { businessRefNo, username, password } = formData;

    if (!businessRefNo.trim()) {
      toast({ title: "Business ID is required", variant: "destructive" });
      return false;
    }

    if (!username.trim()) {
      toast({ title: "Username is required", variant: "destructive" });
      return false;
    }

    if (!password) {
      toast({ title: "Password is required", variant: "destructive" });
      return false;
    }

    return true;
  };

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('signin', {
        body: {
          businessRefNo: formData.businessRefNo.trim(),
          username: formData.username.trim(),
          password: formData.password
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Store session data in localStorage (in production, use more secure storage)
        localStorage.setItem('gatedBusinessSession', JSON.stringify({
          sessionToken: data.sessionToken,
          user: data.user,
          business: data.business,
          loginTime: Date.now()
        }));

        toast({
          title: "Sign In Successful!",
          description: `Welcome back, ${data.user.username}!`
        });

        // Redirect to main app
        navigate('/gated-app');
      } else {
        throw new Error(data?.error || 'Sign in failed');
      }
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
      <div className="content-container w-full max-w-md mx-4">
        {/* Success Message */}
        {message && (
          <Card className="mb-6 border-success/20 bg-success/5">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                <p className="text-sm text-success">{message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-elevated">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle className="text-3xl">Business Portal</CardTitle>
            <CardDescription className="text-lg">
              Sign in to access your business dashboard
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSignin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="businessRefNo" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business ID
                </Label>
                <Input
                  id="businessRefNo"
                  value={formData.businessRefNo}
                  onChange={(e) => handleInputChange('businessRefNo', e.target.value)}
                  placeholder="BUS-20250827-ABC12"
                  required
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Your unique Business ID received during registration
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="admin.user"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full btn-gradient text-lg py-6"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <Separator className="my-6" />

            <div className="text-center space-y-4">
              <Button
                variant="link"
                onClick={() => navigate('/gated-forgot-password')}
                className="text-primary hover:text-primary/80"
              >
                Forgot Password?
              </Button>

              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Need help?</p>
                    <p>Only businesses with verified payment can access this portal. Contact support if you're having trouble signing in.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GatedSignin;