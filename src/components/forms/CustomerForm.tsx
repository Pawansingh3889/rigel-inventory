import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';

interface Customer {
  id?: string;
  customer_ref?: string;
  name: string;
  customer_type?: string;
  is_active?: boolean;
  contact_person?: string;
  phone?: string;
  email?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pin_code?: string;
  country?: string;
  same_as_registered_address?: boolean;
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_pin_code?: string;
  shipping_country?: string;
  gstin?: string;
  gst_tax_location?: string;
  pan_number?: string;
  msme_registration_no?: string;
  business_registration_no?: string;
  payment_terms?: string;
  credit_limit_days?: number;
  preferred_payment_method?: string;
  preferred_currency?: string;
  billing_cycle?: string;
  bank_name?: string;
  branch_name?: string;
  account_number?: string;
  account_type?: string;
  ifsc_code?: string;
  swift_code?: string;
  upi_id?: string;
  credit_limit?: number;
}

interface CustomerFormProps {
  customer?: Customer;
  onSubmit: (data: Customer) => Promise<void>;
  onCancel: () => void;
  readOnly?: boolean;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  customer,
  onSubmit,
  onCancel,
  readOnly = false,
}) => {
  const { hasEditAccess } = useBusinessAuth();
  const [loading, setLoading] = useState(false);
  const [sameAsRegistered, setSameAsRegistered] = useState(customer?.same_as_registered_address || false);
  const canEdit = hasEditAccess('sales') && !readOnly;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Customer>({
    defaultValues: customer || {
      name: '',
      preferred_currency: 'INR',
      customer_type: 'business',
      is_active: true,
      same_as_registered_address: false,
      credit_limit_days: 30,
      preferred_payment_method: 'Bank Transfer',
    },
  });

  const watchedFields = watch(['address_line1', 'address_line2', 'city', 'state', 'country', 'pin_code']);

  useEffect(() => {
    if (sameAsRegistered) {
      setValue('shipping_address_line1', watchedFields[0] || '');
      setValue('shipping_address_line2', watchedFields[1] || '');
      setValue('shipping_city', watchedFields[2] || '');
      setValue('shipping_state', watchedFields[3] || '');
      setValue('shipping_country', watchedFields[4] || '');
      setValue('shipping_pin_code', watchedFields[5] || '');
    }
  }, [sameAsRegistered, watchedFields, setValue]);

  const onFormSubmit = async (data: Customer) => {
    setLoading(true);
    try {
      data.same_as_registered_address = sameAsRegistered;
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting customer:', error);
      toast.error('Failed to save customer');
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
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="customer_ref">Customer ID</Label>
              <Input
                id="customer_ref"
                {...register('customer_ref')}
                placeholder="Auto-generated after submission"
                disabled={true}
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: First 4 letters of customer name + unique number (starting from 1001)
              </p>
            </div>
            <div>
              <Label htmlFor="name">Customer Name / Company Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Customer name is required' })}
                className={errors.name ? 'border-destructive' : ''}
                disabled={!canEdit}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="customer_type">Customer Type</Label>
              <Select
                defaultValue={customer?.customer_type || 'business'}
                onValueChange={(value) => setValue('customer_type', value)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="is_active">Status</Label>
              <Select
                defaultValue={customer?.is_active ? 'Active' : 'Inactive'}
                onValueChange={(value) => setValue('is_active', value === 'Active')}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>✅ Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="contact_person">Primary Contact Person Name</Label>
              <Input
                id="contact_person"
                {...register('contact_person')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone / Mobile</Label>
              <Input
                id="phone"
                {...register('phone')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="website">Website (optional)</Label>
              <Input
                id="website"
                {...register('website')}
                placeholder="https://example.com"
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Details */}
      <Card>
        <CardHeader>
          <CardTitle>✅ Address Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Billing Address */}
          <div>
            <h4 className="font-medium mb-3">Billing Address</h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input
                  id="address_line1"
                  {...register('address_line1')}
                  disabled={!canEdit}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
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
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  {...register('state')}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="pin_code">Postal Code</Label>
                <Input
                  id="pin_code"
                  {...register('pin_code')}
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
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <h4 className="font-medium">Shipping / Delivery Address (if different)</h4>
            </div>
            <div className="flex items-center space-x-2 mb-4">
              <Switch
                id="same_as_registered"
                checked={sameAsRegistered}
                onCheckedChange={setSameAsRegistered}
                disabled={!canEdit}
              />
              <Label htmlFor="same_as_registered">Same as billing address</Label>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="shipping_address_line1">Address Line 1</Label>
                <Input
                  id="shipping_address_line1"
                  {...register('shipping_address_line1')}
                  disabled={sameAsRegistered || !canEdit}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="shipping_address_line2">Address Line 2</Label>
                <Input
                  id="shipping_address_line2"
                  {...register('shipping_address_line2')}
                  disabled={sameAsRegistered || !canEdit}
                />
              </div>
              <div>
                <Label htmlFor="shipping_city">City</Label>
                <Input
                  id="shipping_city"
                  {...register('shipping_city')}
                  disabled={sameAsRegistered || !canEdit}
                />
              </div>
              <div>
                <Label htmlFor="shipping_state">State</Label>
                <Input
                  id="shipping_state"
                  {...register('shipping_state')}
                  disabled={sameAsRegistered || !canEdit}
                />
              </div>
              <div>
                <Label htmlFor="shipping_pin_code">Postal Code</Label>
                <Input
                  id="shipping_pin_code"
                  {...register('shipping_pin_code')}
                  disabled={sameAsRegistered || !canEdit}
                />
              </div>
              <div>
                <Label htmlFor="shipping_country">Country</Label>
                <Input
                  id="shipping_country"
                  {...register('shipping_country')}
                  disabled={sameAsRegistered || !canEdit}
                />
              </div>
            </div>
          </div>

          {/* GST/Tax Location */}
          <div>
            <div>
              <Label htmlFor="gst_tax_location">GST / Tax Location (if required for compliance)</Label>
              <Input
                id="gst_tax_location"
                {...register('gst_tax_location')}
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial & Tax Details */}
      <Card>
        <CardHeader>
          <CardTitle>✅ Financial & Tax Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="gstin">GSTIN (depending on country)</Label>
              <Input
                id="gstin"
                {...register('gstin')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="pan_number">PAN Number</Label>
              <Input
                id="pan_number"
                {...register('pan_number')}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Select
                defaultValue={customer?.payment_terms || ''}
                onValueChange={(value) => setValue('payment_terms', value)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Net 15">Net 15</SelectItem>
                  <SelectItem value="Net 7">Net 7</SelectItem>
                  <SelectItem value="Advance">Advance</SelectItem>
                  <SelectItem value="COD">COD</SelectItem>
                  <SelectItem value="Immediate">Immediate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="credit_limit_days">Credit Limit - Days</Label>
              <Input
                id="credit_limit_days"
                type="number"
                {...register('credit_limit_days', { valueAsNumber: true })}
                placeholder="30"
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="preferred_payment_method">Preferred Payment Method</Label>
              <Select
                defaultValue={customer?.preferred_payment_method || 'Bank Transfer'}
                onValueChange={(value) => setValue('preferred_payment_method', value)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="credit_limit">Credit Limit (Amount)</Label>
              <Input
                id="credit_limit"
                type="number"
                step="0.01"
                {...register('credit_limit', { valueAsNumber: true })}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Bank Details */}
          <div className="mt-6">
            <h4 className="font-medium mb-3">Bank Details (if needed)</h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  {...register('bank_name')}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="branch_name">Branch Address</Label>
                <Input
                  id="branch_name"
                  {...register('branch_name')}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="account_number">Account No</Label>
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
                />
              </div>
              <div>
                <Label htmlFor="upi_id">UPI ID</Label>
                <Input
                  id="upi_id"
                  {...register('upi_id')}
                  placeholder="example@upi"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !canEdit}>
          {loading ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
        </Button>
      </div>
    </form>
  );
};