import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Edit, Trash2, Users, Shield, Eye, ArrowLeft, Clock, CheckCircle, User, Settings, Database, FileText, CreditCard, MapPin, Bot, Package, Building2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AuditLogViewer } from '@/components/AuditLogViewer';
import { CompanyProfile } from '@/components/CompanyProfile';
import { useNavigate } from 'react-router-dom';

interface BusinessUser {
  id: string;
  user_id?: string; // Reference to auth.users.id
  user_ref: string;
  name: string;
  full_name?: string;
  email: string;
  access_type: 'OWNER' | 'ADMIN' | 'USER';
  access_sections: Record<string, 'read' | 'edit'>;
  is_active: boolean;
  password_hash?: string;
  created_by?: string;
  last_login?: string;
  created_at: string;
}

const UserManagement = () => {
  const { company, profile, user } = useAuth();
  const { businessUser, canManageCompany, hasEditAccess, isOwnerOrAdmin, updateSectionPermissions } = useBusinessAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<BusinessUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    access_sections: {} as Record<string, 'read' | 'edit'>,
    is_active: true
  });

  const availableSections = [
    { key: 'inventory', label: 'Inventory Management', icon: Package, description: 'Manage products, stock levels, and warehouse operations' },
    { key: 'sales', label: 'Sales Orders', icon: FileText, description: 'Create and manage sales orders and customer invoices' },
    { key: 'returns', label: 'Returns & Credit Notes', icon: RotateCcw, description: 'Manage product returns and customer credit notes' },
    { key: 'purchases', label: 'Purchase Management', icon: Database, description: 'Handle purchase orders, supplier invoices, and procurement' },
    { key: 'reports', label: 'Reports & Analytics', icon: Settings, description: 'View business reports and analytics dashboards' },
    { key: 'payments', label: 'Payment Processing', icon: CreditCard, description: 'Process payments and manage financial transactions' },
    { key: 'tracking', label: 'Order Tracking', icon: MapPin, description: 'Track order status and delivery management' },
    { key: 'ai', label: 'AI Assistant', icon: Bot, description: 'Access AI-powered business insights and automation' },
    { key: 'company_profile', label: 'Company Profile', icon: Building2, description: 'Manage company information and business settings' }
  ];


  useEffect(() => {
    if (company?.id) {
      fetchUsers();
    }
  }, [company?.id]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch section permissions for all users
      const { data: permissions, error: permError } = await supabase
        .from('company_user_section_permissions')
        .select('*')
        .eq('company_id', company?.id);

      if (permError) {
        console.error('Error fetching permissions:', permError);
      }

      // Create a map of email to permissions
      const permissionsMap = (permissions || []).reduce((map, perm) => {
        map[perm.user_email] = perm.access_sections || {};
        return map;
      }, {} as Record<string, any>);

      setUsers((data || []).map((user: any) => ({
        ...user,
        user_ref: user.username, // Use username as user_ref for display
        name: user.full_name || user.username, // Use full_name if available
        access_type: user.access_type || 'USER',
        access_sections: permissionsMap[user.email] || {},
        is_active: user.status === 'ACTIVE' // Map status to is_active boolean
      } as BusinessUser)));
    } catch (error: any) {
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      access_sections: {},
      is_active: true
    });
    setEditingUser(null);
  };

  const handleOpenDialog = (user?: BusinessUser) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        confirmPassword: '',
        access_sections: user.access_sections || {},
        is_active: user.is_active
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!editingUser && (!formData.password || formData.password.length < 8)) {
        throw new Error('Password must be at least 8 characters long');
      }

      if (!editingUser && formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // For new users, create in Supabase Auth first, then sync to company_users
      if (!editingUser) {
        // Create Auth user and company_user via Edge Function
        const { data: inviteData, error: inviteError } = await supabase.functions.invoke('invite-business-user', {
          body: {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            company_id: company?.id,
            created_by: user?.id
          }
        });

        if (inviteError) {
          console.error('Error creating user:', inviteError);
          throw new Error(inviteError.message || 'Failed to create user');
        }

        if (!inviteData?.success) {
          throw new Error(inviteData?.error || 'Failed to create user');
        }

          if (Object.keys(formData.access_sections).length > 0) {
            await updateSectionPermissions(formData.email, formData.access_sections);
          }

        toast({
          title: "User created successfully",
          description: `${formData.name} has been added to your team and can now log in with their email and password.`
        });
      } else {
        // For existing users, update company_users and optionally Auth user
        const userData: any = {
          username: formData.email,
          email: formData.email,
          full_name: formData.name,
          status: formData.is_active ? 'ACTIVE' : 'INACTIVE' // Map is_active to status
        };

        // Hash password for existing users if password is being updated
        if (formData.password) {
          userData.password_hash = await hashPassword(formData.password);
        }

        const { error } = await supabase
          .from('company_users')
          .update(userData)
          .eq('id', editingUser.id);

        if (error) throw error;

        // Update section permissions for this user
        if (Object.keys(formData.access_sections).length > 0) {
          await updateSectionPermissions(formData.email, formData.access_sections);
        }

        // Update the Auth user via Edge Function if password changed
        if (formData.password) {
          try {
            const { error: inviteError } = await supabase.functions.invoke('invite-business-user', {
              body: {
                email: formData.email,
                password: formData.password,
                name: formData.name,
                company_id: company?.id,
              }
            });
            if (inviteError) {
              console.error('Auth user update error:', inviteError);
            }
          } catch (e) {
            console.error('Auth user update exception:', e);
          }
        }

        toast({
          title: "User updated successfully",
          description: `${formData.name} has been updated.`
        });
      }

      handleCloseDialog();
      fetchUsers();
    } catch (error: any) {
      toast({
        title: editingUser ? "Error updating user" : "Error creating user",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) return;

    try {
      const { error } = await supabase
        .from('company_users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "User deleted",
        description: `${userName} has been removed from your team.`
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error deleting user",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSectionPermission = (sectionKey: string, permission: 'read' | 'edit') => {
    setFormData(prev => ({
      ...prev,
      access_sections: {
        ...prev.access_sections,
        [sectionKey]: permission
      }
    }));
  };

  const removeSectionAccess = (sectionKey: string) => {
    setFormData(prev => {
      const newSections = { ...prev.access_sections };
      delete newSections[sectionKey];
      return {
        ...prev,
        access_sections: newSections
      };
    });
  };

  if (!isOwnerOrAdmin()) {
    return (
      <DashboardLayout title="User Management" subtitle="Access Denied">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access user management.
            </CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Team Management" 
      subtitle="Manage your team members and their access permissions"
      activeView="users"
      onNavigate={(view) => {
        if (view === 'dashboard') navigate('/dashboard');
      }}
      headerActions={
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      }
      >
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Members
            </TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Profile
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Team Members</h2>
                <p className="text-muted-foreground">
                  Manage users and their access to different sections
                </p>
              </div>
              <Button 
                onClick={() => handleOpenDialog()} 
                className="btn-gradient"
                disabled={!hasEditAccess('user_management')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No team members yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start by adding your first team member
                    </p>
                    <Button 
                      onClick={() => handleOpenDialog()} 
                      className="btn-gradient"
                      disabled={!hasEditAccess('user_management')}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add First User
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Access Sections</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <div className="font-semibold">{user.name}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {user.user_ref}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {['OWNER','ADMIN'].includes(user.access_type) ? (
                                <Badge>Full Access</Badge>
                              ) : Object.keys(user.access_sections || {}).length ? (
                                <div className="flex flex-wrap gap-1 max-w-sm">
                                   {Object.entries(user.access_sections || {}).map(([section, permission]) => {
                                     const sectionData = availableSections.find(s => s.key === section);
                                     const sectionLabel = sectionData?.label || section;
                                    return (
                                      <Badge 
                                        key={section} 
                                        variant={permission === 'edit' ? 'default' : 'outline'} 
                                        className="text-xs"
                                      >
                                        {sectionLabel}: {permission}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No access</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={user.is_active ? 'default' : 'destructive'}
                                className={user.is_active ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
                              >
                                {user.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => handleOpenDialog(user)}
                                   disabled={!hasEditAccess('user_management')}
                                 >
                                   <Edit className="h-4 w-4" />
                                 </Button>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => handleDeleteUser(user.id, user.name)}
                                   disabled={!hasEditAccess('user_management')}
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

            <TabsContent value="company" className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">Company Profile</h2>
                    <p className="text-muted-foreground">
                      {canManageCompany() ? 'View and edit company information' : 'View company information'}
                    </p>
                  </div>
                  {!canManageCompany() && (
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Read Only
                    </Badge>
                  )}
                </div>
                <CompanyProfile readonly={!canManageCompany()} />
              </div>
            </TabsContent>
          <TabsContent value="audit" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Transaction Audit Log</h2>
                <p className="text-muted-foreground">
                  Track all user actions and system changes with timestamps
                </p>
              </div>
            </div>
            
            <AuditLogViewer />
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <User className="h-5 w-5" />
                {editingUser ? 'Edit Team Member' : 'Add New Team Member'}
              </DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? 'Update user information and access permissions'
                  : 'Create a new team member with appropriate role and access permissions'
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter full name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address (Login ID) *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="user@company.com"
                      disabled={!!editingUser}
                      required
                    />
                    {editingUser && (
                      <p className="text-xs text-muted-foreground">Email cannot be changed after creation</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Security</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password {!editingUser && '*'}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                      required={!editingUser}
                      minLength={8}
                    />
                    {!editingUser && (
                      <p className="text-xs text-muted-foreground">Must be at least 8 characters long</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password {!editingUser && '*'}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder={editingUser ? "Confirm new password" : "Confirm password"}
                      required={!editingUser || (editingUser && !!formData.password)}
                    />
                  </div>
                </div>
              </div>


              {/* Section Permissions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Eye className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Section Access Permissions</h3>
                </div>
                
                <div className="text-sm text-muted-foreground mb-4">
                  Configure which sections this user can access and their permission level for each section.
                </div>
                
                <div className="grid gap-4">
                  {availableSections.map((section) => {
                    const hasAccess = formData.access_sections[section.key];
                    const SectionIcon = section.icon;
                    
                    return (
                      <Card key={section.key} className={`transition-all duration-200 ${hasAccess ? 'ring-2 ring-primary/20 bg-primary/5' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3">
                              <SectionIcon className="h-5 w-5 text-primary mt-0.5" />
                              <div>
                                <h4 className="font-medium text-sm">{section.label}</h4>
                                <p className="text-xs text-muted-foreground">{section.description}</p>
                              </div>
                            </div>
                            {hasAccess && (
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeSectionAccess(section.key)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          
                          <RadioGroup
                            value={hasAccess || ''}
                            onValueChange={(value: 'read' | 'edit') => handleSectionPermission(section.key, value)}
                            className="flex gap-6"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="read" id={`${section.key}-read`} />
                              <Label htmlFor={`${section.key}-read`} className="text-sm font-medium">
                                Read Only
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="edit" id={`${section.key}-edit`} />
                              <Label htmlFor={`${section.key}-edit`} className="text-sm font-medium">
                                Full Access
                              </Label>
                            </div>
                          </RadioGroup>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-2">Permission Levels:</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>• <strong>Read Only:</strong> View data, reports, and information without making changes</div>
                    <div>• <strong>Full Access:</strong> Complete access to create, read, update, and delete records</div>
                  </div>
                </div>
              </div>

              {/* Account Status */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Account Status</h3>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label htmlFor="is_active" className="text-sm font-medium">Account Status</Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.is_active ? 'User can log in and access assigned sections' : 'User cannot log in or access the system'}
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, is_active: checked }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="btn-gradient">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingUser ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingUser ? 'Update User' : 'Create User'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
};

export default UserManagement;