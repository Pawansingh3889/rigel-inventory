import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeHtml } from '@/lib/security';
import { 
  Loader2, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText,
  CheckCircle,
  Send,
  Clock
} from 'lucide-react';

const GatedBusinessRegistration = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [businessRefNo, setBusinessRefNo] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  const paymentData = location.state as any;
  const searchParams = new URLSearchParams(location.search);
  const isPaymentVerified = searchParams.get('txn') === 'DEV-SUCCESS' || paymentData?.paymentVerified;
  const isEmailPreVerified = searchParams.get('email_verified') === 'true';

  // Redirect if no payment verification
  useEffect(() => {
    if (!isPaymentVerified) {
      navigate('/checkout');
    }
    if (isEmailPreVerified) {
      setEmailVerified(true);
      setCurrentStep(2);
    }
  }, [isPaymentVerified, isEmailPreVerified, navigate]);

  const [formData, setFormData] = useState({
    // Business Details
    businessName: '',
    email: '',
    phone: '',
    addrLine1: '',
    addrLine2: '',
    state: '',
    pinCode: '',
    country: 'India',
    businessType: '',
    industryType: '',
    gstin: '',
    // Admin User
    username: '',
    password: '',
    confirmPassword: ''
  });

  const businessTypes = [
    'Proprietorship',
    'Partnership',
    'Private Limited',
    'LLP',
    'Others'
  ];

  const industryTypes = [
    'Manufacturing',
    'Logistics',
    'Retail',
    'IT Services',
    'Healthcare',
    'Education',
    'Other'
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    const { businessName, email, phone, addrLine1, state, pinCode, businessType, industryType } = formData;
    
    if (!businessName.trim() || !email.trim() || !phone.trim() || !addrLine1.trim() || 
        !state.trim() || !pinCode.trim() || !businessType || !industryType) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return false;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return false;
    }

    if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
      toast({ title: "Please enter phone in E.164 format (e.g., +911234567890)", variant: "destructive" });
      return false;
    }

    if (formData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/.test(formData.gstin)) {
      toast({ title: "Please enter a valid 15-character GSTIN", variant: "destructive" });
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    if (!emailVerified) {
      toast({ title: "Please confirm your email first", variant: "destructive" });
      return false;
    }

    const { username, password, confirmPassword } = formData;

    if (!username.trim() || !password || !confirmPassword) {
      toast({ title: "Please fill all login credentials", variant: "destructive" });
      return false;
    }

    if (!/^[A-Za-z][A-Za-z0-9._]{3,19}$/.test(username)) {
      toast({ title: "Username must be 4-20 characters, start with letter, contain only letters, numbers, dots, and underscores", variant: "destructive" });
      return false;
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password)) {
      toast({ title: "Password must be at least 8 characters with uppercase, lowercase, number, and special character", variant: "destructive" });
      return false;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return false;
    }

    return true;
  };

  const sendEmailConfirmation = async () => {
    if (!validateStep1()) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-confirmation', {
        body: {
          email: formData.email,
          purpose: 'register'
        }
      });

      if (error) throw error;

      if (data?.success) {
        setEmailSent(true);
        setResendCount(prev => prev + 1);
        toast({
          title: "Confirmation Email Sent!",
          description: "Please check your email and click the confirmation link."
        });
      } else {
        throw new Error(data?.error || 'Failed to send confirmation email');
      }
    } catch (error: any) {
      toast({
        title: "Failed to send confirmation email",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const registerBusiness = async () => {
    if (!validateStep2()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-business', {
        body: {
          businessDetails: {
            name: sanitizeHtml(formData.businessName),
            email: formData.email,
            phone: formData.phone,
            addrLine1: sanitizeHtml(formData.addrLine1),
            addrLine2: formData.addrLine2 ? sanitizeHtml(formData.addrLine2) : '',
            state: sanitizeHtml(formData.state),
            pinCode: formData.pinCode,
            country: formData.country,
            businessType: formData.businessType,
            industryType: formData.industryType,
            gstin: formData.gstin || ''
          },
          username: formData.username,
          password: formData.password
        }
      });

      if (error) throw error;

      if (data?.success) {
        setBusinessRefNo(data.businessRefNo);
        setIsSuccess(true);
        toast({
          title: "Registration Complete!",
          description: `Your Business ID is ${data.businessRefNo}`
        });
      } else {
        throw new Error(data?.error || 'Registration failed');
      }
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="max-w-md mx-4 shadow-elevated">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-2xl text-success">Registration Complete!</CardTitle>
            <CardDescription>
              Your business has been successfully registered
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <Label className="text-sm text-muted-foreground">Business ID</Label>
              <div className="text-2xl font-bold text-primary mt-1">{businessRefNo}</div>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Important:</strong> Save this Business ID safely. You'll need it to sign in along with your username and password.
            </p>
            <Button onClick={() => navigate('/gated-signin')} className="w-full btn-gradient">
              Proceed to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="content-container section-padding py-20">
        <div className="max-w-2xl mx-auto">
          {/* Payment Success Badge */}
          {paymentData?.paymentVerified && (
            <Card className="mb-8 border-success/20 bg-success/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="secondary" className="mb-2 bg-success/10 text-success">
                      Payment Verified
                    </Badge>
                    <p className="font-semibold">Business Plan Activated</p>
                    <p className="text-sm text-muted-foreground">
                      Amount Paid: ₹{paymentData.amount?.toLocaleString()}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>
                1
              </div>
              <div className={`w-20 h-1 ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>
                2
              </div>
            </div>
          </div>

          <Card className="shadow-elevated">
            <CardHeader className="text-center">
              <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle className="text-3xl">
                {currentStep === 1 ? 'Business Details & Email Verification' : 'Admin Login Setup'}
              </CardTitle>
              <CardDescription className="text-lg">
                {currentStep === 1 
                  ? 'Enter your business information and verify your email'
                  : 'Create admin credentials for your business portal'
                }
              </CardDescription>
            </CardHeader>

            <CardContent>
              {currentStep === 1 ? (
                <div className="space-y-6">
                  {/* Business Details Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="businessName">Business Name *</Label>
                      <Input
                        id="businessName"
                        value={formData.businessName}
                        onChange={(e) => handleInputChange('businessName', e.target.value)}
                        placeholder="Enter your business name"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">Registered Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="business@example.com"
                        required
                        disabled={emailVerified}
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+911234567890"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="addrLine1">Address Line 1 *</Label>
                      <Input
                        id="addrLine1"
                        value={formData.addrLine1}
                        onChange={(e) => handleInputChange('addrLine1', e.target.value)}
                        placeholder="Street address"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="addrLine2">Address Line 2</Label>
                      <Input
                        id="addrLine2"
                        value={formData.addrLine2}
                        onChange={(e) => handleInputChange('addrLine2', e.target.value)}
                        placeholder="Apartment, suite, etc."
                      />
                    </div>

                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => handleInputChange('state', e.target.value)}
                        placeholder="State"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="pinCode">PIN/Postal Code *</Label>
                      <Input
                        id="pinCode"
                        value={formData.pinCode}
                        onChange={(e) => handleInputChange('pinCode', e.target.value)}
                        placeholder="400001"
                        required
                      />
                    </div>

                    <div>
                      <Label>Business Type *</Label>
                      <Select onValueChange={(value) => handleInputChange('businessType', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                        <SelectContent>
                          {businessTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Industry Type *</Label>
                      <Select onValueChange={(value) => handleInputChange('industryType', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {industryTypes.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="gstin">GSTIN (Optional)</Label>
                      <Input
                        id="gstin"
                        value={formData.gstin}
                        onChange={(e) => handleInputChange('gstin', e.target.value.toUpperCase())}
                        placeholder="22AAAAA0000A1Z5"
                        maxLength={15}
                      />
                    </div>
                  </div>

                  {/* Email Confirmation Section */}
                  {!emailVerified && (
                    <div className="border-t pt-6">
                      <h3 className="font-semibold mb-4 flex items-center">
                        <Mail className="h-5 w-5 mr-2" />
                        Email Verification
                      </h3>
                      
                      {!emailSent ? (
                        <Button
                          onClick={sendEmailConfirmation}
                          disabled={isLoading}
                          className="w-full"
                          variant="outline"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending confirmation email...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Send Confirmation Email
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                              <strong>Confirmation email sent!</strong><br />
                              Please check your inbox and click the confirmation link to verify your email address.
                            </p>
                          </div>
                          
                          <Button
                            onClick={sendEmailConfirmation}
                            disabled={isLoading || resendCount >= 3}
                            variant="outline"
                            className="w-full"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Resending...
                              </>
                            ) : (
                              <>
                                <Mail className="mr-2 h-4 w-4" />
                                Resend Confirmation Email
                              </>
                            )}
                          </Button>

                          {resendCount >= 3 && (
                            <p className="text-xs text-destructive">
                              Maximum resend attempts reached. Please try again in an hour.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {emailVerified && (
                    <div className="border-t pt-6">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                          <p className="text-sm text-green-800">
                            <strong>Email verified successfully!</strong> You can now proceed to set up your admin credentials.
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => setCurrentStep(2)}
                        className="w-full mt-4 btn-gradient"
                      >
                        Continue to Admin Setup
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Admin Credentials Form */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        placeholder="admin.user"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        4-20 characters, start with letter, only letters, numbers, dots, and underscores
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder="Enter password"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        At least 8 characters with uppercase, lowercase, number, and special character
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        placeholder="Confirm password"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    onClick={registerBusiness}
                    disabled={isLoading}
                    className="w-full btn-gradient text-lg py-6"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Registering Business...
                      </>
                    ) : (
                      <>
                        <Building2 className="mr-2 h-5 w-5" />
                        Complete Registration
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GatedBusinessRegistration;