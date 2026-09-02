import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeHtml } from '@/lib/security';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Loader2, Building2, Save, Phone, Mail, Globe, MapPin, User, Lock, Eye, EyeOff, LogIn, AlertCircle, CheckCircle, IdCard } from 'lucide-react';

interface CompanyProfileProps {
  readonly?: boolean;
}

export function CompanyProfile({ readonly = false }: CompanyProfileProps) {
  const { company, profile, user, loading } = useAuth();
  const { hasEditAccess } = useBusinessAuth();
  const { toast } = useToast();
  
  // Check if user has edit access for company profile
  const canEdit = !readonly && hasEditAccess('company_profile');

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading your profile...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInData, setSignInData] = useState({ username: '', password: '' });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [formData, setFormData] = useState({
    name: company?.name || '',
    email: company?.email || '',
    phone: company?.phone || '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    website: company?.website || '',
    status: company?.status || 'active',
    gstn: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  // Generate Business ID based on company name and current date
  const generateBusinessId = (companyName: string) => {
    if (!companyName) return '';
    const firstFourLetters = companyName.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase();
    const currentDate = new Date();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    return `PRISM-${firstFourLetters}-${month}-${year}`;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validatePassword = (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar
    };
  };

  const passwordValidation = validatePassword(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);
    
    try {
      // Here you would implement sign-in logic with business credentials
      // This is a placeholder for the actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      toast({
        title: "Sign in successful",
        description: "Welcome back!",
      });
      
      setShowSignIn(false);
      setSignInData({ username: '', password: '' });
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleForgotPassword = () => {
    toast({
      title: "Password reset",
      description: "Password reset instructions will be sent to your registered email.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate phone number if provided
      if (formData.phone) {
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(formData.phone.replace(/\D/g, ''))) {
          toast({
            title: "Invalid phone number",
            description: "Phone number must be exactly 10 digits",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Validate password if provided
      if (formData.password && !passwordValidation.isValid) {
        toast({
          title: "Invalid password",
          description: "Password must meet all security requirements",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (formData.password && !passwordsMatch) {
        toast({
          title: "Passwords don't match",
          description: "Please ensure both password fields match",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Sanitize form inputs before submission
      const sanitizedData = {
        name: sanitizeHtml(formData.name),
        email: formData.email,
        phone: formData.phone,
        address: [
          formData.addressLine1,
          formData.addressLine2,
          formData.city,
          formData.state,
          formData.country,
          formData.postalCode
        ].filter(Boolean).join(', '),
        address_line1: sanitizeHtml(formData.addressLine1),
        address_line2: sanitizeHtml(formData.addressLine2),
        city: sanitizeHtml(formData.city),
        state: sanitizeHtml(formData.state),
        country: sanitizeHtml(formData.country),
        postal_code: formData.postalCode,
        website: formData.website,
        status: formData.status,
        gstn: formData.gstn,
        business_ref_no: generateBusinessId(formData.name),
        updated_at: new Date().toISOString(),
      };

      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to continue.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // If profile is missing, create it automatically
      if (!profile) {
        try {
          const userData = user.user_metadata || {};
          
          // Create a minimal company record first if none exists
          let targetCompanyId = company?.id;
          if (!targetCompanyId) {
            const { data: newCompany, error: companyError } = await supabase
              .from('companies')
              .insert({
                name: formData.name || userData.company_name || 'My Company',
                email: formData.email || userData.email || user.email,
                phone: formData.phone || userData.phone,
                city: formData.city || userData.city,
                state: formData.state || userData.state,
                country: formData.country || userData.country,
              })
              .select()
              .single();

            if (companyError) throw companyError;
            targetCompanyId = newCompany.id;
          }

          // Create the missing profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              company_id: targetCompanyId,
              first_name: userData.first_name,
              last_name: userData.last_name,
              phone: userData.phone,
              city: userData.city,
              state: userData.state,
              country: userData.country,
              role: 'owner'
            });

          if (profileError) throw profileError;

          toast({
            title: "Profile created",
            description: "Your profile has been set up. Please reload the page.",
          });
          
          setTimeout(() => window.location.reload(), 1000);
          setIsLoading(false);
          return;
        } catch (error: any) {
          toast({
            title: "Setup failed",
            description: "Could not create your profile. Please try again.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      let targetCompanyId = company?.id;

      // If no company exists yet, create one and link it to the profile
      if (!targetCompanyId) {
        const { data: created, error: insertErr } = await supabase
          .from('companies')
          .insert([{ ...sanitizedData }])
          .select('*')
          .single();

        if (insertErr) {
          toast({ title: 'Create failed', description: insertErr.message, variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        targetCompanyId = created.id;

        // Link to user profile
        await supabase
          .from('profiles')
          .update({ company_id: targetCompanyId })
          .eq('user_id', user.id);
        } else {
          const { error } = await supabase
            .from('companies')
            .update(sanitizedData)
            .eq('id', targetCompanyId);

          if (error) {
            toast({
              title: "Update failed",
              description: error.message,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        }

        // Note: Authentication credentials are now handled via Supabase Auth
        // The business_credentials table has been removed in favor of using Supabase's built-in auth system

      toast({
        title: "Company saved",
        description: "Your company details have been saved successfully.",
      });

      // Refresh the page to reload context
      setTimeout(() => window.location.reload(), 800);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update form data when company data changes
  React.useEffect(() => {
    if (company) {
      setFormData(prev => ({
        ...prev,
        name: company.name || '',
        email: company.email || '',
        phone: company.phone || '',
        addressLine1: (company as any).address_line1 || '',
        addressLine2: (company as any).address_line2 || '',
        city: (company as any).city || '',
        state: (company as any).state || '',
        country: (company as any).country || '',
        postalCode: (company as any).postal_code || '',
        website: company.website || '',
        status: company.status || 'active',
        gstn: (company as any).gstn || '',
      }));
    }
  }, [company]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Sign In Section - Only show if user can edit */}
      {canEdit && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <LogIn className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>Sign In</CardTitle>
                  <CardDescription>Access with your business credentials</CardDescription>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowSignIn(!showSignIn)}
              >
                {showSignIn ? 'Cancel' : 'Sign In'}
              </Button>
            </div>
          </CardHeader>
          {showSignIn && (
            <CardContent>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-username">Username</Label>
                  <Input
                    id="signin-username"
                    value={signInData.username}
                    onChange={(e) => setSignInData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter your username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={signInData.password}
                    onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSigningIn}>
                  {isSigningIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
      )}

      {/* Company Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Company Profile</CardTitle>
              <CardDescription>
                Update your company information and business details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business ID Field */}
            <div className="space-y-2">
              <Label htmlFor="business-id" className="flex items-center gap-2">
                <IdCard className="h-4 w-4" />
                Business ID
              </Label>
              <Input
                id="business-id"
                value={company ? ((company as any).business_ref_no || generateBusinessId(formData.name)) : generateBusinessId(formData.name)}
                placeholder="Auto-generated based on company name and registration date"
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Format: PRISM-(First 4 letters of company)-(MM)-(YYYY)
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name *</Label>
              <Input
                id="company-name"
                value={formData.name}
                onChange={canEdit ? (e) => handleInputChange('name', e.target.value) : undefined}
                placeholder="Your Company Ltd."
                required
                disabled={!canEdit}
                className={!canEdit ? "bg-muted" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstn">GSTN</Label>
              <Input
                id="gstn"
                value={formData.gstn}
                onChange={canEdit ? (e) => handleInputChange('gstn', e.target.value) : undefined}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                disabled={!canEdit}
                className={!canEdit ? "bg-muted" : ""}
              />
            </div>

          <div className="space-y-2">
            <Label htmlFor="company-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Company Email
            </Label>
            <Input
              id="company-email"
              type="email"
              value={formData.email}
              onChange={canEdit ? (e) => handleInputChange('email', e.target.value) : undefined}
              placeholder="contact@yourcompany.com"
              disabled={!canEdit}
              className={!canEdit ? "bg-muted" : ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Company Phone (10 digits)
            </Label>
            <Input
              id="company-phone"
              type="tel"
              value={formData.phone}
              onChange={canEdit ? (e) => handleInputChange('phone', e.target.value) : undefined}
              placeholder="1234567890"
              pattern="\d{10}"
              maxLength={10}
              title="Please enter exactly 10 digits"
              disabled={!canEdit}
              className={!canEdit ? "bg-muted" : ""}
            />
          </div>

            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Company Address
              </Label>
              
              <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="address-line1">Address Line 1 *</Label>
                    <Input
                      id="address-line1"
                      value={formData.addressLine1}
                      onChange={canEdit ? (e) => handleInputChange('addressLine1', e.target.value) : undefined}
                      placeholder="Street address, building number"
                      required={canEdit}
                      disabled={!canEdit}
                      className={!canEdit ? "bg-muted" : ""}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="address-line2">Address Line 2</Label>
                    <Input
                      id="address-line2"
                      value={formData.addressLine2}
                      onChange={canEdit ? (e) => handleInputChange('addressLine2', e.target.value) : undefined}
                      placeholder="Apartment, suite, floor (optional)"
                      disabled={!canEdit}
                      className={!canEdit ? "bg-muted" : ""}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={canEdit ? (e) => handleInputChange('city', e.target.value) : undefined}
                        placeholder="City"
                        required={canEdit}
                        disabled={!canEdit}
                        className={!canEdit ? "bg-muted" : ""}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={canEdit ? (e) => handleInputChange('state', e.target.value) : undefined}
                        placeholder="State/Province"
                        required={canEdit}
                        disabled={!canEdit}
                        className={!canEdit ? "bg-muted" : ""}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="country">Country *</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={canEdit ? (e) => handleInputChange('country', e.target.value) : undefined}
                        placeholder="Country"
                        required={canEdit}
                        disabled={!canEdit}
                        className={!canEdit ? "bg-muted" : ""}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="postal-code">Postal Code *</Label>
                      <Input
                        id="postal-code"
                        value={formData.postalCode}
                        onChange={canEdit ? (e) => handleInputChange('postalCode', e.target.value) : undefined}
                        placeholder="Postal/ZIP code"
                        required={canEdit}
                        disabled={!canEdit}
                        className={!canEdit ? "bg-muted" : ""}
                      />
                    </div>
                  </div>
              </div>
            </div>

          <div className="space-y-2">
            <Label htmlFor="company-website" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Website
            </Label>
            <Input
              id="company-website"
              type="url"
              value={formData.website}
              onChange={canEdit ? (e) => handleInputChange('website', e.target.value) : undefined}
              placeholder="https://www.yourcompany.com"
              disabled={!canEdit}
              className={!canEdit ? "bg-muted" : ""}
            />
          </div>

            <div className="space-y-2">
              <Label htmlFor="company-status">Company Status</Label>
              <select
                id="company-status"
                value={formData.status}
                onChange={canEdit ? (e) => handleInputChange('status', e.target.value) : undefined}
                disabled={!canEdit}
                className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${!canEdit ? "bg-muted" : ""}`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <Separator />

            {/* Authentication Section - Only show if user can edit */}
            {canEdit && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Authentication Details</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="username" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Username *
                  </Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="Enter password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {formData.password && (
                    <div className="space-y-2 p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">Password Requirements:</p>
                      <div className="space-y-1 text-sm">
                        <div className={`flex items-center gap-2 ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`}>
                          {passwordValidation.minLength ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          At least 8 characters
                        </div>
                        <div className={`flex items-center gap-2 ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-red-600'}`}>
                          {passwordValidation.hasUpperCase ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          One uppercase letter
                        </div>
                        <div className={`flex items-center gap-2 ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-red-600'}`}>
                          {passwordValidation.hasLowerCase ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          One lowercase letter
                        </div>
                        <div className={`flex items-center gap-2 ${passwordValidation.hasNumbers ? 'text-green-600' : 'text-red-600'}`}>
                          {passwordValidation.hasNumbers ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          One number
                        </div>
                        <div className={`flex items-center gap-2 ${passwordValidation.hasSpecialChar ? 'text-green-600' : 'text-red-600'}`}>
                          {passwordValidation.hasSpecialChar ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          One special character
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Reconfirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder="Reconfirm password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {formData.confirmPassword && (
                    <Alert className={passwordsMatch ? "border-green-500" : "border-red-500"}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className={passwordsMatch ? "text-green-600" : "text-red-600"}>
                        {passwordsMatch ? (
                          <span className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3" />
                            Passwords match
                          </span>
                        ) : (
                          "Passwords do not match"
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            )}

              {canEdit && (
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Update Company Profile
                    </>
                  )}
                </Button>
              )}
          </form>
        </CardContent>
      </Card>

      {/* Forgot Password Section - Only show if user can edit */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Forgot Password?</CardTitle>
            <CardDescription>
              Reset your password if you've forgotten it
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={handleForgotPassword}
              className="w-full"
            >
              Send Password Reset Instructions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}