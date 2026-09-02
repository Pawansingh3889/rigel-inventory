import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PaymentForm } from "@/components/forms/PaymentForm";
import { Trash2, Edit, Plus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_number: string;
  payment_type: string;
  payment_status: string;
  notes: string;
  created_at: string;
}

interface PaymentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  recordType: 'grn' | 'sales_invoice';
  recordNumber: string;
  totalAmount: number;
  companyId: string;
  onPaymentChange: () => void;
}

export const PaymentHistoryDialog: React.FC<PaymentHistoryDialogProps> = ({
  open,
  onOpenChange,
  recordId,
  recordType,
  recordNumber,
  totalAmount,
  companyId,
  onPaymentChange
}) => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq(recordType === 'grn' ? 'grn_id' : 'sales_invoice_id', recordId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPayments();
    }
  }, [open, recordId]);

  const handleDeletePayment = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment deleted successfully"
      });

      fetchPayments();
      onPaymentChange();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handlePaymentSave = () => {
    setShowPaymentForm(false);
    setEditingPayment(null);
    fetchPayments();
    onPaymentChange();
  };

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const pendingAmount = totalAmount - totalPaid;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="bg-red-100 text-red-700">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'advance':
        return <Badge variant="outline" className="bg-blue-100 text-blue-700">Advance</Badge>;
      case 'regular':
        return <Badge variant="outline">Regular</Badge>;
      case 'final':
        return <Badge variant="outline" className="bg-purple-100 text-purple-700">Final</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment History - {recordNumber}</DialogTitle>
        </DialogHeader>

        {showPaymentForm ? (
          <PaymentForm
            mode={editingPayment ? 'edit' : 'create'}
            payment={editingPayment}
            recordId={recordId}
            recordType={recordType}
            onSave={handlePaymentSave}
            onCancel={() => {
              setShowPaymentForm(false);
              setEditingPayment(null);
            }}
            companyId={companyId}
            maxAmount={pendingAmount + (editingPayment?.amount || 0)}
          />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Amount</div>
                <div className="text-lg font-semibold">₹{totalAmount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Paid</div>
                <div className="text-lg font-semibold text-green-600">₹{totalPaid.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Pending</div>
                <div className="text-lg font-semibold text-orange-600">₹{pendingAmount.toLocaleString()}</div>
              </div>
              <div className="flex items-center">
                <Button onClick={() => setShowPaymentForm(true)} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Payment
                </Button>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        Loading payments...
                      </TableCell>
                    </TableRow>
                  ) : payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        No payments recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">₹{payment.amount.toLocaleString()}</TableCell>
                        <TableCell>{getTypeBadge(payment.payment_type)}</TableCell>
                        <TableCell>{payment.payment_method}</TableCell>
                        <TableCell>{payment.reference_number || '-'}</TableCell>
                        <TableCell>{getStatusBadge(payment.payment_status)}</TableCell>
                        <TableCell className="max-w-32 truncate">{payment.notes || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingPayment(payment);
                                setShowPaymentForm(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Payment</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this payment? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePayment(payment.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};