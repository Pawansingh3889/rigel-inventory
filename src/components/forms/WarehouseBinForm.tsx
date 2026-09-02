import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Building2, MapPin, User, Phone, Mail, Settings } from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
  'Uttarakhand', 'West Bengal', 'Andaman & Nicobar Islands', 'Chandigarh', 
  'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 
  'Lakshadweep', 'Puducherry'
];

interface WarehouseBin {
  id: string;
  wh_bin_code: string;
  bin_name: string;
  warehouse_name?: string;
  warehouse_code?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

interface ValidationErrors {
  warehouse_name?: string;
  warehouse_code?: string;
  wh_bin_code?: string;
  bin_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
}

interface WarehouseBinFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingBin?: WarehouseBin | null;
}

export function WarehouseBinForm({ open, onOpenChange, onSuccess, editingBin }: WarehouseBinFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isActive, setIsActive] = useState(editingBin?.is_active ?? true);
  const [isDefault, setIsDefault] = useState(editingBin?.is_default ?? false);

  // Validation functions
  const validateWarehouseName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter warehouse name (min 3 characters).";
    if (trimmed.length < 3 || trimmed.length > 30) return "Enter warehouse name (min 3 characters).";
    if (!/^[A-Za-z0-9 \-_&]+$/.test(trimmed)) return "Enter warehouse name (min 3 characters).";
    return undefined;
  };

  const validateBinCode = (value: string): string | undefined => {
    if (!value) return "Enter valid BIN code (1–10 uppercase letters/numbers).";
    if (!/^[A-Z0-9]{1,10}$/.test(value)) return "Enter valid BIN code (1–10 uppercase letters/numbers).";
    return undefined;
  };

  const validateBinName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter BIN/section name.";
    if (trimmed.length < 2 || trimmed.length > 30) return "Enter BIN/section name.";
    return undefined;
  };

  const validateAddressLine1 = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter address line 1 (min 5 characters).";
    if (trimmed.length < 5 || trimmed.length > 80) return "Enter address line 1 (min 5 characters).";
    return undefined;
  };

  const validateCity = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter valid city name.";
    if (!/^[A-Za-z ]{2,100}$/.test(trimmed)) return "Enter valid city name.";
    return undefined;
  };

  const validateState = (value: string): string | undefined => {
    if (!value) return "Select state.";
    if (!INDIAN_STATES.includes(value)) return "Select state.";
    return undefined;
  };

  const validatePinCode = (value: string): string | undefined => {
    if (!value) return "Enter valid 6-digit PIN code.";
    if (!/^\d{6}$/.test(value)) return "Enter valid 6-digit PIN code.";
    return undefined;
  };

  const validatePhone = (value: string): string | undefined => {
    if (!value) return undefined; // Optional
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length !== 10) return "Enter valid 10-digit mobile number.";
    if (!/^[6-9]/.test(cleaned)) return "Enter valid 10-digit mobile number.";
    return undefined;
  };

  const validateEmail = (value: string): string | undefined => {
    if (!value) return undefined; // Optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(value)) return "Enter valid email address.";
    return undefined;
  };

  const handleFieldChange = async (name: keyof ValidationErrors, value: string) => {
    // Auto-uppercase for specific fields
    if (name === 'warehouse_code' || name === 'wh_bin_code') {
      value = value.toUpperCase();
    }
    
    let error: string | undefined;
    switch (name) {
      case 'warehouse_name':
        error = validateWarehouseName(value);
        break;
      case 'wh_bin_code':
        error = validateBinCode(value.toUpperCase());
        break;
      case 'bin_name':
        error = validateBinName(value);
        break;
      case 'address_line1':
        error = validateAddressLine1(value);
        break;
      case 'city':
        error = validateCity(value);
        break;
      case 'state':
        error = validateState(value);
        break;
      case 'postal_code':
        error = validatePinCode(value);
        break;
      case 'contact_person_phone':
        error = validatePhone(value);
        break;
      case 'contact_person_email':
        error = validateEmail(value);
        break;
    }

    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const validateForm = async (formData: FormData): Promise<boolean> => {
    const newErrors: ValidationErrors = {};
    
    // Required field validations
    const warehouseNameError = validateWarehouseName(formData.get('warehouse_name') as string || '');
    if (warehouseNameError) newErrors.warehouse_name = warehouseNameError;
    
    const binCodeError = validateBinCode(formData.get('wh_bin_code') as string || '');
    if (binCodeError) newErrors.wh_bin_code = binCodeError;
    
    const binNameError = validateBinName(formData.get('bin_name') as string || '');
    if (binNameError) newErrors.bin_name = binNameError;
    
    const addressLine1Error = validateAddressLine1(formData.get('address_line1') as string || '');
    if (addressLine1Error) newErrors.address_line1 = addressLine1Error;
    
    const cityError = validateCity(formData.get('city') as string || '');
    if (cityError) newErrors.city = cityError;
    
    const stateError = validateState(formData.get('state') as string || '');
    if (stateError) newErrors.state = stateError;
    
    const pinCodeError = validatePinCode(formData.get('postal_code') as string || '');
    if (pinCodeError) newErrors.postal_code = pinCodeError;
    
    const phoneError = validatePhone(formData.get('contact_person_phone') as string || '');
    if (phoneError) newErrors.contact_person_phone = phoneError;
    
    const emailError = validateEmail(formData.get('contact_person_email') as string || '');
    if (emailError) newErrors.contact_person_email = emailError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!profile?.company_id) {
      toast({
        title: "Error",
        description: "User profile not found or company not set",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    
    if (!await validateForm(formData)) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    // Normalize phone number to E.164 format
    let phone = formData.get('contact_person_phone') as string || '';
    if (phone) {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
        phone = `+91${cleaned}`;
      }
    }

    const binData = {
      wh_bin_code: (formData.get('wh_bin_code') as string).toUpperCase(),
      bin_name: (formData.get('bin_name') as string).trim(),
      warehouse_name: (formData.get('warehouse_name') as string)?.trim() || null,
      warehouse_code: (formData.get('warehouse_code') as string)?.trim().toUpperCase() || null,
      address_line1: (formData.get('address_line1') as string)?.trim() || null,
      address_line2: (formData.get('address_line2') as string)?.trim() || null,
      city: (formData.get('city') as string)?.trim() || null,
      state: (formData.get('state') as string)?.trim() || null,
      country: 'IN', // Always India
      postal_code: (formData.get('postal_code') as string)?.trim() || null,
      contact_person_name: (formData.get('contact_person_name') as string)?.trim() || null,
      contact_person_phone: phone || null,
      contact_person_email: (formData.get('contact_person_email') as string)?.trim() || null,
      is_active: isActive,
      is_default: isDefault,
      company_id: profile.company_id,
    };

    try {
      let error;
      
      if (editingBin) {
        const { error: updateError } = await supabase
          .from('warehouse_bins')
          .update(binData)
          .eq('id', editingBin.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('warehouse_bins')
          .insert([binData]);
        error = insertError;
      }

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Error",
            description: "This BIN code already exists in this warehouse. Please use a different BIN code.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Success",
        description: `Warehouse and BIN ${editingBin ? 'updated' : 'created'} successfully`,
      });

      onOpenChange(false);
      onSuccess();
      
      // Reset form
      (e.target as HTMLFormElement).reset();
      setErrors({});
      setIsActive(true);
      setIsDefault(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to ${editingBin ? 'update' : 'create'} warehouse and BIN`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            {editingBin ? 'Edit Warehouse & BIN' : 'Create Warehouse & BIN Location'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {editingBin ? 'Update warehouse and bin details' : 'Create warehouse location with bin details to organize inventory'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[calc(90vh-8rem)] overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Warehouse & BIN Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Warehouse & BIN Info</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="warehouse_name" className="text-xs font-medium">
                    Warehouse Name <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="warehouse_name" 
                    name="warehouse_name" 
                    placeholder="Main Distribution Center"
                    defaultValue={editingBin?.warehouse_name || ''}
                    onChange={(e) => handleFieldChange('warehouse_name', e.target.value)}
                    className={`h-8 text-sm ${errors.warehouse_name ? 'border-red-500' : ''}`}
                    required
                  />
                  {errors.warehouse_name && <p className="text-xs text-red-500 mt-1">{errors.warehouse_name}</p>}
                </div>
                
                <div>
                  <Label htmlFor="warehouse_code" className="text-xs font-medium">Warehouse Code</Label>
                  <Input 
                    id="warehouse_code" 
                    name="warehouse_code" 
                    placeholder="WH001"
                    defaultValue={editingBin?.warehouse_code || ''}
                    onChange={(e) => handleFieldChange('warehouse_code', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="wh_bin_code" className="text-xs font-medium">
                    BIN Code <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="wh_bin_code" 
                    name="wh_bin_code" 
                    placeholder="A001"
                    maxLength={10}
                    style={{ textTransform: 'uppercase' }}
                    defaultValue={editingBin?.wh_bin_code || ''}
                    onChange={(e) => handleFieldChange('wh_bin_code', e.target.value)}
                    className={`h-8 text-sm ${errors.wh_bin_code ? 'border-red-500' : ''}`}
                    required
                  />
                  {errors.wh_bin_code && (
                    <p className="text-xs text-red-500 mt-1">{errors.wh_bin_code}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="bin_name" className="text-xs font-medium">
                    BIN/Section Name <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="bin_name" 
                    name="bin_name" 
                    placeholder="Electronics Section A"
                    defaultValue={editingBin?.bin_name || ''}
                    onChange={(e) => handleFieldChange('bin_name', e.target.value)}
                    className={`h-8 text-sm ${errors.bin_name ? 'border-red-500' : ''}`}
                    required
                  />
                  {errors.bin_name && (
                    <p className="text-xs text-red-500 mt-1">{errors.bin_name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Column - Warehouse Address */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Warehouse Address</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="address_line1" className="text-xs font-medium">
                    Address Line 1 <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="address_line1" 
                    name="address_line1" 
                    placeholder="123 Industrial Street"
                    defaultValue={editingBin?.address_line1 || ''}
                    onChange={(e) => handleFieldChange('address_line1', e.target.value)}
                    className={`h-8 text-sm ${errors.address_line1 ? 'border-red-500' : ''}`}
                    required
                  />
                  {errors.address_line1 && <p className="text-xs text-red-500 mt-1">{errors.address_line1}</p>}
                </div>
                
                <div>
                  <Label htmlFor="address_line2" className="text-xs font-medium">Address Line 2</Label>
                  <Input 
                    id="address_line2" 
                    name="address_line2" 
                    placeholder="Building B, Floor 2"
                    defaultValue={editingBin?.address_line2 || ''}
                    onChange={(e) => handleFieldChange('address_line2', e.target.value)}
                    className={`h-8 text-sm ${errors.address_line2 ? 'border-red-500' : ''}`}
                  />
                  {errors.address_line2 && <p className="text-xs text-red-500 mt-1">{errors.address_line2}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="city" className="text-xs font-medium">
                      City <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      id="city" 
                      name="city" 
                      placeholder="Mumbai"
                      defaultValue={editingBin?.city || ''}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      className={`h-8 text-sm ${errors.city ? 'border-red-500' : ''}`}
                      required
                    />
                    {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                  </div>
                  
                  <div>
                    <Label htmlFor="postal_code" className="text-xs font-medium">
                      PIN Code <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      id="postal_code" 
                      name="postal_code" 
                      placeholder="400001"
                      defaultValue={editingBin?.postal_code || ''}
                      onChange={(e) => handleFieldChange('postal_code', e.target.value)}
                      className={`h-8 text-sm ${errors.postal_code ? 'border-red-500' : ''}`}
                      required
                    />
                    {errors.postal_code && <p className="text-xs text-red-500 mt-1">{errors.postal_code}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="state" className="text-xs font-medium">
                    State <span className="text-red-500">*</span>
                  </Label>
                  <Select defaultValue={editingBin?.state || ''} name="state" required>
                    <SelectTrigger className={`h-8 text-sm ${errors.state ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map(state => (
                        <SelectItem key={state} value={state} className="text-sm">{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                </div>

                <input type="hidden" name="country" value="IN" />
              </div>
            </div>

            {/* Right Column - Contact Information & Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <User className="h-4 w-4 text-primary" />
                <h3 className="font-medium">Contact & Settings</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="contact_person_name" className="text-xs font-medium">Contact Person</Label>
                  <Input
                    id="contact_person_name"
                    name="contact_person_name"
                    placeholder="John Smith"
                    defaultValue={editingBin?.contact_person_name || ''}
                    onChange={(e) => handleFieldChange('contact_person_name', e.target.value)}
                    className={`h-8 text-sm ${errors.contact_person_name ? 'border-red-500' : ''}`}
                  />
                  {errors.contact_person_name && <p className="text-xs text-red-500 mt-1">{errors.contact_person_name}</p>}
                </div>

                <div>
                  <Label htmlFor="contact_person_phone" className="text-xs font-medium">Phone Number</Label>
                  <Input
                    id="contact_person_phone"
                    name="contact_person_phone"
                    placeholder="9876543210"
                    defaultValue={editingBin?.contact_person_phone || ''}
                    onChange={(e) => handleFieldChange('contact_person_phone', e.target.value)}
                    className={`h-8 text-sm ${errors.contact_person_phone ? 'border-red-500' : ''}`}
                  />
                  {errors.contact_person_phone && <p className="text-xs text-red-500 mt-1">{errors.contact_person_phone}</p>}
                </div>

                <div>
                  <Label htmlFor="contact_person_email" className="text-xs font-medium">Email Address</Label>
                  <Input
                    id="contact_person_email"
                    name="contact_person_email"
                    type="email"
                    placeholder="contact@warehouse.com"
                    defaultValue={editingBin?.contact_person_email || ''}
                    onChange={(e) => handleFieldChange('contact_person_email', e.target.value)}
                    className={`h-8 text-sm ${errors.contact_person_email ? 'border-red-500' : ''}`}
                  />
                  {errors.contact_person_email && <p className="text-xs text-red-500 mt-1">{errors.contact_person_email}</p>}
                </div>

                {/* Settings */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_active" className="text-xs font-medium">Active</Label>
                      <p className="text-xs text-muted-foreground">Enable this warehouse location</p>
                    </div>
                    <Switch
                      id="is_active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_default" className="text-xs font-medium">Default</Label>
                      <p className="text-xs text-muted-foreground">Set as default warehouse location</p>
                    </div>
                    <Switch
                      id="is_default"
                      checked={isDefault}
                      onCheckedChange={setIsDefault}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="min-w-[100px]"
            >
              {loading ? 'Saving...' : (editingBin ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}