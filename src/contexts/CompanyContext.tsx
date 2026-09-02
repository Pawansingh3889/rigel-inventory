import React, { createContext, useContext, useState, useEffect } from 'react';

interface Company {
  id: string;
  businessRefNo: string;
  name: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2?: string;
    state: string;
    postal: string;
    country: string;
  };
  gstin?: string;
  status: string;
}

interface CompanyUser {
  id: string;
  username: string;
  email: string;
  accessType: string;
  status: string;
}

interface CompanyContextType {
  company: Company | null;
  user: CompanyUser | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  signIn: (businessRefNo: string, username: string, password: string) => Promise<boolean>;
  signOut: () => void;
  switchCompany: (companyId: string) => Promise<boolean>;
  availableCompanies: Company[];
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};

interface CompanyProviderProps {
  children: React.ReactNode;
}

export const CompanyProvider: React.FC<CompanyProviderProps> = ({ children }) => {
  const [company, setCompany] = useState<Company | null>(null);
  const [user, setUser] = useState<CompanyUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);

  const isAuthenticated = Boolean(company && user && sessionToken);

  // Load saved session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('company_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setCompany(session.company);
        setUser(session.user);
        setSessionToken(session.sessionToken);
      } catch (error) {
        console.error('Failed to parse saved session:', error);
        localStorage.removeItem('company_session');
      }
    }
  }, []);

  const signIn = async (businessRefNo: string, username: string, password: string): Promise<boolean> => {
    try {
      // This would typically call the signin edge function
      // For now, we'll simulate a successful response
      const mockResponse = {
        success: true,
        sessionToken: 'mock-session-token',
        user: {
          id: '1',
          username,
          email: `${username}@company.com`,
          accessType: 'OWNER',
          status: 'ACTIVE'
        },
        company: {
          id: '1',
          businessRefNo,
          name: 'Mock Company',
          email: 'company@example.com',
          phone: '+1234567890',
          address: {
            line1: '123 Business St',
            line2: '',
            state: 'State',
            postal: '12345',
            country: 'Country'
          },
          gstin: 'MOCK123456789',
          status: 'active'
        }
      };

      if (mockResponse.success) {
        setUser(mockResponse.user);
        setCompany(mockResponse.company);
        setSessionToken(mockResponse.sessionToken);
        
        // Save to localStorage
        localStorage.setItem('company_session', JSON.stringify({
          user: mockResponse.user,
          company: mockResponse.company,
          sessionToken: mockResponse.sessionToken
        }));

        return true;
      }
      return false;
    } catch (error) {
      console.error('Sign in error:', error);
      return false;
    }
  };

  const signOut = () => {
    setUser(null);
    setCompany(null);
    setSessionToken(null);
    setAvailableCompanies([]);
    localStorage.removeItem('company_session');
  };

  const switchCompany = async (companyId: string): Promise<boolean> => {
    // Implementation for switching between companies for multi-tenant users
    // This would fetch the company data and update the context
    console.log('Switching to company:', companyId);
    return true;
  };

  const value: CompanyContextType = {
    company,
    user,
    sessionToken,
    isAuthenticated,
    signIn,
    signOut,
    switchCompany,
    availableCompanies
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};