import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { emailSchema, passwordSchema, nameSchema, phoneSchema, otpSchema, checkRateLimit, hashEmail, logSecurityEvent, SecuritySeverity } from '@/lib/security';

interface Profile {
  id: string;
  user_id: string;
  company_id: string;
  first_name: string | null;
  last_name: string | null;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone_verified: boolean;
  avatar_url: string | null;
  is_active: boolean;
}

interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  status: 'active' | 'inactive' | 'suspended';
  business_ref_no: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: any }>;
  signUp: (
    email: string, 
    password: string, 
    companyName: string, 
    firstName: string, 
    lastName: string,
    phone: string,
    city: string,
    state: string,
    country: string
  ) => Promise<{ error: any; needsEmailVerification?: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  checkExistingUser: (email: string, companyName: string) => Promise<{ emailExists: boolean; companyExists: boolean }>;
  resendConfirmation: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    console.log('Auth effect started');
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', { event, session: !!session, user: !!session?.user });
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('User found, fetching profile...');
          // Clear any pending verification email since user is now authenticated
          sessionStorage.removeItem('pendingVerificationEmail');
          
          // Fetch user profile and company data
          setTimeout(async () => {
            try {
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle();

              let effectiveProfile = profileData;

              if (profileError && (profileError as any).code !== 'PGRST116') {
                console.error('Error fetching profile:', profileError);
              }

              // If no profile found, try auto-recovery
              if (!effectiveProfile && event === 'SIGNED_IN') {
                console.log('No profile found, attempting auto-recovery...');
                await createMissingUserRecords(session.user);
                return; // Exit early as createMissingUserRecords will reload the page
              }

              console.log('Profile resolved:', effectiveProfile);
              setProfile(effectiveProfile as any);

              // If the user's profile is inactive, force sign-out
              if (effectiveProfile && (effectiveProfile as any).is_active === false) {
                console.warn('Profile is inactive; signing out');
                toast({ title: 'Sign in blocked', description: 'Your account is inactive. Please contact your administrator.', variant: 'destructive' });
                await supabase.auth.signOut();
                setLoading(false);
                return;
              }

              if (effectiveProfile?.company_id) {
                console.log('Fetching company data...');
                const { data: companyData, error: companyError } = await supabase
                  .from('companies')
                  .select('*')
                  .eq('id', effectiveProfile.company_id)
                  .maybeSingle();

                if (companyError && (companyError as any).code !== 'PGRST116') {
                  console.error('Error fetching company:', companyError);
                }

                if (companyData) {
                  console.log('Company fetched:', companyData);
                  setCompany(companyData as any);
                }
              }
            } catch (error) {
              console.error('Error in auth state change:', error);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          console.log('No user, clearing profile and company');
          setProfile(null);
          setCompany(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    console.log('Checking for existing session...');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', { session: !!session, user: !!session?.user });
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        console.log('No initial session found');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    try {
      // Normalize inputs
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      // Validate normalized input
      const emailValidation = emailSchema.safeParse(normalizedEmail);
      const passwordValidation = passwordSchema.safeParse(trimmedPassword);
      
      if (!emailValidation.success) {
        toast({
          title: "Invalid email",
          description: emailValidation.error.errors[0].message,
          variant: "destructive",
        });
        return { error: new Error(emailValidation.error.errors[0].message) };
      }
      
      if (!passwordValidation.success) {
        toast({
          title: "Invalid password",
          description: passwordValidation.error.errors[0].message,
          variant: "destructive",
        });
        return { error: new Error(passwordValidation.error.errors[0].message) };
      }

      // Check rate limiting using email
      const rateLimit = await checkRateLimit(supabase, normalizedEmail);
      if (!rateLimit.allowed) {
        const resetTime = rateLimit.resetTime?.toLocaleTimeString() || 'later';
        toast({
          title: "Too many attempts",
          description: `Please try again after ${resetTime}`,
          variant: "destructive",
        });
        // Soft limit: allow the sign-in attempt to proceed to avoid false lockouts during testing
      }

      console.log('Attempting sign in for:', normalizedEmail);

      // Proceed with Supabase authentication and optional captcha token
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: trimmedPassword,
        options: captchaToken ? { captchaToken } : undefined as any,
      } as any);

      if (!authError) {
        // Reset rate limiting counter for this email on successful login
        try {
          await supabase
            .from('auth_rate_limits')
            .delete()
            .eq('hashed_email', await hashEmail(normalizedEmail));
        } catch (e) {
          console.warn('Failed to reset rate limit after successful login', e);
        }
        // Authentication successful
        await logSecurityEvent(supabase, 'login_success', { email: normalizedEmail }, undefined, SecuritySeverity.LOW);
        toast({ title: 'Welcome back!', description: 'You have been signed in successfully.' });
        return { error: null };
      }

      // Handle failure
      let errorMessage = 'Invalid email or password';
      if (typeof authError.message === 'string') {
        if (authError.message.toLowerCase().includes('email not confirmed')) {
          errorMessage = 'Please contact your administrator to activate your account.';
        } else if (authError.message.toLowerCase().includes('invalid login credentials')) {
          errorMessage = 'Invalid email or password';
        }
      }

      console.error('Sign in failed:', { authError: authError.message });
      await logSecurityEvent(supabase, 'login_failed', { email: normalizedEmail, authError: authError.message }, undefined, SecuritySeverity.MEDIUM);

      toast({ title: 'Sign in failed', description: errorMessage, variant: 'destructive' });
      return { error: authError };

    } catch (error: any) {
      console.error('Sign in error:', error);
      toast({
        title: "Sign in failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    companyName: string, 
    firstName: string, 
    lastName: string,
    phone: string,
    city: string,
    state: string,
    country: string
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            first_name: firstName,
            last_name: lastName,
            company_name: companyName,
            phone: phone,
            city: city,
            state: state,
            country: country,
          }
        }
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Account created successfully!",
        description: "Welcome to PRISM ERP. Your account is ready to use.",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    // Always clear local state first for immediate UI feedback
    const clearLocalState = () => {
      setUser(null);
      setSession(null);
      setProfile(null);
      setCompany(null);
      
      // Clear any stored auth data from localStorage
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('pendingVerificationEmail');
    };

    try {
      // Check if we have a valid session before attempting sign out
      const { data: currentSession } = await supabase.auth.getSession();
      
      if (currentSession?.session) {
        // We have a valid session, attempt proper sign out
        const { error } = await supabase.auth.signOut();
        
        // Handle session mismatch errors gracefully
        if (error && error.message.includes('Auth session missing')) {
          console.log('Session already invalid, clearing local state');
          clearLocalState();
          toast({
            title: "Signed out",
            description: "You have been signed out successfully.",
          });
          return;
        }
        
        if (error) {
          console.error('Sign out error:', error);
          // For other errors, still clear local state but show a generic message
          clearLocalState();
          toast({
            title: "Signed out",
            description: "You have been signed out.",
          });
          return;
        }
      }
      
      // Clear state regardless of API call result
      clearLocalState();
      
      toast({
        title: "Signed out successfully",
        description: "You have been signed out.",
      });
      
    } catch (error: any) {
      console.error('Sign out catch error:', error);
      // Always clear local state even if everything fails
      clearLocalState();
      
      // Don't show error for session mismatch issues
      if (error.message && error.message.includes('Auth session missing')) {
        toast({
          title: "Signed out",
          description: "You have been signed out successfully.",
        });
      } else {
        toast({
          title: "Signed out",
          description: "You have been signed out.",
        });
      }
    }
  };

  // Auto-recovery function for missing user records
  const createMissingUserRecords = async (user: any) => {
    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('user_id', user.id)
        .single();

      if (!existingProfile && user.user_metadata) {
        console.log('Creating missing user records for:', user.email);
        
        // Create missing company and profile records
        const userData = user.user_metadata;
        
        // Create company first
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: userData.company_name || 'My Company',
            email: userData.email || user.email,
            phone: userData.phone,
            city: userData.city,
            state: userData.state,
            country: userData.country,
            address: [userData.city, userData.state, userData.country].filter(Boolean).join(', ')
          })
          .select()
          .single();

        if (companyError) {
          console.error('Company creation error:', companyError);
          return;
        }

        // Create profile linked to company
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            company_id: newCompany.id,
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: userData.phone,
            city: userData.city,
            state: userData.state,
            country: userData.country,
            role: 'owner'
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          return;
        }

        console.log('Successfully created missing records, refreshing...');
        // Refresh data
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      console.error('Auto-recovery error:', error);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!profile) return { error: new Error('No profile found') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        toast({
          title: "Update failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      setProfile({ ...profile, ...updates });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };


  const resendConfirmation = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) {
        toast({
          title: "Failed to resend email",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Email sent!",
        description: "Please check your inbox for the verification link.",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Failed to resend email",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/auth?tab=reset`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "Reset failed",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      toast({
        title: "Reset link sent",
        description: "Check your email for password reset instructions",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return { error };
    }
  };

  const checkExistingUser = async (email: string, companyName: string) => {
    try {
      // Check if email exists using our database function
      const { data: emailExists, error: emailError } = await supabase
        .rpc('check_email_exists', { email_to_check: email });

      // Check if company name exists
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('name', companyName)
        .limit(1);

      return {
        emailExists: emailExists || false,
        companyExists: companyData && companyData.length > 0
      };
    } catch (error) {
      console.error('Error checking existing user:', error);
      return { emailExists: false, companyExists: false };
    }
  };

  const value = {
    user,
    session,
    profile,
    company,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    resetPassword,
    checkExistingUser,
    resendConfirmation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};