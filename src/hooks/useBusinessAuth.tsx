import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BusinessUser {
  id: string;
  username: string;
  email: string;
  access_type: 'OWNER' | 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE';
  company_id: string;
}

interface SectionPermissions {
  [sectionKey: string]: 'read' | 'edit';
}

export const useBusinessAuth = () => {
  const { user, company } = useAuth();
  const [businessUser, setBusinessUser] = useState<BusinessUser | null>(null);
  const [sectionPermissions, setSectionPermissions] = useState<SectionPermissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email && company?.id) {
      fetchBusinessUser();
      fetchSectionPermissions();
    } else {
      setLoading(false);
    }
  }, [user?.email, company?.id]);

  const fetchBusinessUser = async () => {
    try {
      const { data, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('email', user?.email)
        .eq('company_id', company?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Error fetching business user:', error);
      } else {
        setBusinessUser(data as BusinessUser);
      }
    } catch (error) {
      console.error('Business user fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSectionPermissions = async () => {
    if (!user?.email || !company?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('company_user_section_permissions')
        .select('access_sections')
        .eq('company_id', company.id)
        .eq('user_email', user.email)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Error fetching section permissions:', error);
      } else if (data && data.access_sections) {
        setSectionPermissions(data.access_sections as SectionPermissions);
      }
    } catch (error) {
      console.error('Section permissions fetch error:', error);
    }
  };

  // Consolidated role checking to prevent privilege escalation
  const getEffectiveRole = (): 'OWNER' | 'ADMIN' | 'MANAGER' | 'USER' => {
    // Role lives in company_users.access_type. The profiles table has no
    // role column, so that is the only source.
    if (businessUser?.access_type) {
      return businessUser.access_type;
    }
    
    return 'USER'; // Default to lowest privilege
  };

  const hasAccess = (section: string): boolean => {
    const effectiveRole = getEffectiveRole();
    
    // Owners and Admins always have access
    if (effectiveRole === 'OWNER' || effectiveRole === 'ADMIN') return true;
    
    // Managers have access but may be restricted in some sections
    if (effectiveRole === 'MANAGER') return true;
    
    // Regular users need explicit section permissions
    return sectionPermissions[section] === 'read' || sectionPermissions[section] === 'edit';
  };

  const hasEditAccess = (section: string): boolean => {
    const effectiveRole = getEffectiveRole();
    
    // Owners and Admins always have edit access
    if (effectiveRole === 'OWNER' || effectiveRole === 'ADMIN') return true;
    
    // Managers may have edit access depending on section
    if (effectiveRole === 'MANAGER') {
      // Define manager restrictions for sensitive sections
      const restrictedSections = ['user-management', 'company-settings', 'billing'];
      if (restrictedSections.includes(section)) {
        return false; // Managers cannot edit these sections
      }
      return true;
    }
    
    // Regular users need explicit edit permissions
    return sectionPermissions[section] === 'edit';
  };

  const canPerformAction = (section: string, action: 'read' | 'edit'): boolean => {
    if (action === 'read') {
      return hasAccess(section);
    }
    return hasEditAccess(section);
  };

  const isOwnerOrAdmin = (): boolean => {
    const effectiveRole = getEffectiveRole();
    return effectiveRole === 'OWNER' || effectiveRole === 'ADMIN';
  };

  const canManageUsers = (): boolean => {
    const effectiveRole = getEffectiveRole();
    return effectiveRole === 'OWNER' || effectiveRole === 'ADMIN';
  };

  const canManageRoles = (targetRole: 'owner' | 'admin' | 'manager' | 'staff'): boolean => {
    const effectiveRole = getEffectiveRole();
    
    // Only owners can create other owners
    if (targetRole === 'owner') {
      return effectiveRole === 'OWNER';
    }
    
    // Owners and admins can manage other roles below them
    if (targetRole === 'admin') {
      return effectiveRole === 'OWNER';
    }
    
    if (targetRole === 'manager' || targetRole === 'staff') {
      return effectiveRole === 'OWNER' || effectiveRole === 'ADMIN';
    }
    
    return false;
  };

  const canManageCompany = (): boolean => {
    return isOwnerOrAdmin();
  };

  const updateSectionPermissions = async (userEmail: string, permissions: SectionPermissions) => {
    if (!company?.id) return;

    try {
      const { error } = await supabase
        .from('company_user_section_permissions')
        .upsert({
          company_id: company.id,
          user_email: userEmail,
          access_sections: permissions
        }, {
          onConflict: 'company_id,user_email'
        });

      if (error) throw error;
      
      // Refresh permissions if updating current user
      if (userEmail === user?.email) {
        setSectionPermissions(permissions);
      }
    } catch (error) {
      console.error('Error updating section permissions:', error);
      throw error;
    }
  };

  return {
    businessUser,
    sectionPermissions,
    loading,
    hasAccess,
    hasEditAccess,
    canPerformAction,
    isOwnerOrAdmin,
    canManageCompany,
    canManageUsers,
    canManageRoles,
    getEffectiveRole,
    updateSectionPermissions,
    refetch: fetchBusinessUser
  };
};