import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

interface PaymentFormProps {
  mode: 'create' | 'edit';
  payment?: any;
  recordId: string;
  recordType: 'grn' | 'sales_invoice';
  onSave: () => void;
  onCancel: () => void;
  companyId: string;
  maxAmount?: number;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  mode,
  payment,
  recordId,
  recordType,
  onSave,
  onCancel,
  companyId,
  maxAmount
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [formData, setFormData] = useState({
    amount: payment?.amount || '',
    payment_method: payment?.payment_method || '',
    payment_date: payment?.payment_date || new Date().toISOString().split('T')[0],
    reference_number: payment?.reference_number || '',
    payment_type: payment?.payment_type || 'regular',
    notes: payment?.notes || ''
  });

  const sanitizeAmountInput = (value: string): string => {
    // Remove any non-digit, non-decimal characters
    let sanitized = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      sanitized = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    return sanitized;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, decimal point
    if ([8, 9, 27, 13, 46, 110, 190].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true)) {
      return;
    }
    
    // Ensure that it is a number and stop the keypress
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  const validateAmount = (value: string): string => {
    const amount = parseFloat(value);
    if (!value || isNaN(amount)) {
      return 'Please enter a valid amount';
    }
    if (amount <= 0) {
      return 'Amount must be greater than 0';
    }
    if (maxAmount && amount > maxAmount) {
      return `Amount cannot exceed ₹${maxAmount.toLocaleString()}`;
    }
    return '';
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeAmountInput(e.target.value);
    setFormData({ ...formData, amount: sanitized });
    
    const error = validateAmount(sanitized);
    setAmountError(error);
  };

  const handleAmountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    let clampedValue = value;
    
    if (value) {
      const amount = parseFloat(value);
      if (!isNaN(amount)) {
        if (amount < 0) {
          clampedValue = '0';
        } else if (maxAmount && amount > maxAmount) {
          clampedValue = maxAmount.toString();
        }
      }
    }
    
    if (clampedValue !== value) {
      setFormData({ ...formData, amount: clampedValue });
    }
    
    const error = validateAmount(clampedValue);
    setAmountError(error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate amount before submission
      const amountValidationError = validateAmount(formData.amount);
      if (amountValidationError) {
        toast({
          title: "Error",
          description: amountValidationError,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const amount = parseFloat(formData.amount);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to record payments",
          variant: "destructive"
        });
        return;
      }

      // Fetch profile id for created_by FK
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.id) {
        toast({
          title: "Profile not found",
          description: "Your user profile is missing. Please re-login or contact an admin.",
          variant: "destructive"
        });
        return;
      }

      const paymentData: TablesInsert<'payments'> = {
        amount,
        payment_method: formData.payment_method,
        payment_date: formData.payment_date,
        reference_number: formData.reference_number,
        payment_type: formData.payment_type,
        notes: formData.notes,
        company_id: companyId,
        created_by: profile.id,
        payment_status: 'completed',
        ...(recordType === 'grn' ? { grn_id: recordId } : { sales_invoice_id: recordId })
      };

      if (mode === 'create') {
        const { error } = await supabase
          .from('payments')
          .insert(paymentData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Payment recorded successfully"
        });
      } else {
        const { error } = await supabase
          .from('payments')
          .update({
            amount: paymentData.amount,
            payment_method: paymentData.payment_method,
            payment_date: paymentData.payment_date,
            reference_number: paymentData.reference_number,
            payment_type: paymentData.payment_type,
            notes: paymentData.notes
          })
          .eq('id', payment.id);

        if (error) throw error;

        toast({
          title: "Success", 
          description: "Payment updated successfully"
        });
      }

      onSave();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleAmountChange}
            onKeyDown={handleKeyDown}
            onBlur={handleAmountBlur}
            required
            className={amountError ? "border-destructive" : ""}
          />
          {amountError && (
            <p className="text-sm text-destructive mt-1">{amountError}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="payment_type">Payment Type</Label>
          <Select value={formData.payment_type} onValueChange={(value) => setFormData({ ...formData, payment_type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="advance">Advance Payment</SelectItem>
              <SelectItem value="regular">Regular Payment</SelectItem>
              <SelectItem value="final">Final Payment</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment_method">Payment Method *</Label>
          <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
              <SelectItem value="Cheque">Cheque</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="Card">Card</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="payment_date">Payment Date *</Label>
          <Input
            id="payment_date"
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="reference_number">Reference Number</Label>
        <Input
          id="reference_number"
          placeholder="Payment reference"
          value={formData.reference_number}
          onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Additional notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !!amountError || !formData.amount}>
          {loading ? 'Saving...' : mode === 'create' ? 'Record Payment' : 'Update Payment'}
        </Button>
      </div>
    </form>
  );
};