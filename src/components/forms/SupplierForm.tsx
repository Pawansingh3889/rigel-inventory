import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';

interface Supplier {
  id?: string;
  supplier_ref?: string;
  name: string;
  supplier_type?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
  gst_number?: string;
  tax_id?: string;
  pan_number?: string;
  business_registration_no?: string;
  preferred_currency?: string;
  payment_terms?: string;
  bank_name?: string;
  branch_name?: string;
  account_number?: string;
  ifsc_code?: string;
  swift_code?: string;
  is_active?: boolean;
}

interface SupplierFormProps {
  supplier?: Supplier;
  onSubmit: (data: Supplier) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
}

export const SupplierForm: React.FC<SupplierFormProps> = ({
  supplier,
  onSubmit,
  onCancel,
  readOnly = false,
}) => {
  const { hasEditAccess } = useBusinessAuth();
  const [loading, setLoading] = useState(false);
  const canEdit = hasEditAccess('purchase') && !readOnly;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Supplier>({
    defaultValues: supplier || {
      name: '',
      supplier_type: 'Manufacturer',
      preferred_currency: 'INR',
      payment_terms: 'Net 30',
      country: 'India',
      is_active: true,
    },
  });

  const onFormSubmit = async (data: Supplier) => {
    setLoading(true);
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting supplier:', error);
      toast.error('Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier_ref">Supplier ID</Label>
              <Input
                id="supplier_ref"
                {...register('supplier_ref')}
                placeholder="Auto-generated"
                disabled={true}
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: First 4 letters + DDMMYYYY
              </p>
            </div>
            <div>
              <Label htmlFor="name">Supplier Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Supplier name is required' })}
                className={errors.name ? 'border-destructive' : ''}
                disabled={!canEdit}
                placeholder="Legal/Trade name"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="supplier_type">Supplier Type</Label>
              <Select
                defaultValue={supplier?.supplier_type || 'Manufacturer'}
                onValueChange={(value) => setValue('supplier_type', value)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="Distributor">Distributor</SelectItem>
                  <SelectItem value="Service Provider">Service Provider</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                {...register('contact_person')}
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Details */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                {...register('phone')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="email">Email ID</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                disabled={!canEdit}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="website">Website (optional)</Label>
              <Input
                id="website"
                {...register('website')}
                disabled={!canEdit}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Details */}
      <Card>
        <CardHeader>
          <CardTitle>Address Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                {...register('address_line1')}
                disabled={!canEdit}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address_line2">Address Line 2 (optional)</Label>
              <Input
                id="address_line2"
                {...register('address_line2')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                {...register('city')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="state">State / Province</Label>
              <Input
                id="state"
                {...register('state')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                {...register('country')}
                defaultValue="India"
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="pin_code">Postal / PIN Code</Label>
              <Input
                id="pin_code"
                {...register('pin_code')}
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business & Tax Details */}
      <Card>
        <CardHeader>
          <CardTitle>Business & Tax Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gst_number">GSTIN / VAT / Tax ID *</Label>
              <Input
                id="gst_number"
                {...register('gst_number', { required: 'Tax ID is required for compliance' })}
                className={errors.gst_number ? 'border-destructive' : ''}
                disabled={!canEdit}
                placeholder="For compliance"
              />
              {errors.gst_number && (
                <p className="text-sm text-destructive mt-1">{errors.gst_number.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="pan_number">PAN Number (optional)</Label>
              <Input
                id="pan_number"
                {...register('pan_number')}
                disabled={!canEdit}
                placeholder="Country-specific"
              />
            </div>
            <div>
              <Label htmlFor="business_registration_no">Business Registration No. (optional)</Label>
              <Input
                id="business_registration_no"
                {...register('business_registration_no')}
                disabled={!canEdit}
                placeholder="Country-specific"
              />
            </div>
            <div>
              <Label htmlFor="preferred_currency">Preferred Currency</Label>
              <Select
                defaultValue={supplier?.preferred_currency || 'INR'}
                onValueChange={(value) => setValue('preferred_currency', value)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Select
                defaultValue={supplier?.payment_terms || 'Net 30'}
                onValueChange={(value) => setValue('payment_terms', value)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Net 15">Net 15</SelectItem>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Net 45">Net 45</SelectItem>
                  <SelectItem value="Net 60">Net 60</SelectItem>
                  <SelectItem value="Advance">Advance</SelectItem>
                  <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banking Details */}
      <Card>
        <CardHeader>
          <CardTitle>Banking Details (for payments)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                {...register('bank_name')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="branch_name">Branch Name</Label>
              <Input
                id="branch_name"
                {...register('branch_name')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                {...register('account_number')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="ifsc_code">IFSC Code</Label>
              <Input
                id="ifsc_code"
                {...register('ifsc_code')}
                disabled={!canEdit}
                placeholder="For Indian banks"
              />
            </div>
            <div>
              <Label htmlFor="swift_code">SWIFT Code</Label>
              <Input
                id="swift_code"
                {...register('swift_code')}
                disabled={!canEdit}
                placeholder="For international transfers"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status & Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Status & Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              {...register('is_active')}
              disabled={!canEdit}
              defaultChecked={supplier?.is_active !== false}
            />
            <Label htmlFor="is_active">Active Status</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !canEdit}>
          {loading ? 'Saving...' : supplier ? 'Update Supplier' : 'Create Supplier'}
        </Button>
      </div>
    </form>
  );
};