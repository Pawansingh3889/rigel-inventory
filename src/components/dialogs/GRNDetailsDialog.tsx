import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Package, Building2, Calendar, DollarSign, FileText, Receipt } from 'lucide-react';

interface GRNDetailsProps {
  grnId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GRNDetailsDialog({ grnId, open, onOpenChange }: GRNDetailsProps) {
  const [grnDetails, setGRNDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && grnId) {
      fetchGRNDetails();
    }
  }, [open, grnId]);

  const fetchGRNDetails = async () => {
    if (!grnId) return;

    try {
      setLoading(true);
      setError(null);

      // 1) Fetch header only
      const { data: header, error: headerError } = await supabase
        .from('grn_header')
        .select('*')
        .eq('id', grnId)
        .maybeSingle();
      if (headerError) throw headerError;
      if (!header) throw new Error('GRN not found');

      // 2) Fetch related records separately (avoid relationship joins)
      const [itemsRes, paymentsRes, supplierRes, poRes] = await Promise.all([
        supabase.from('grn_line_items').select('*').eq('grn_header_id', grnId),
        supabase.from('payments').select('amount, payment_date, payment_method, payment_status').eq('grn_id', grnId),
        header.supplier_id
          ? supabase.from('suppliers').select('*').eq('id', header.supplier_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        header.purchase_order_id
          ? supabase.from('purchase_orders').select('po_number, order_date').eq('id', header.purchase_order_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const composed = {
        ...header,
        supplier: supplierRes.data || null,
        purchase_order: poRes.data || null,
        grn_line_items: itemsRes.data || [],
        payments: paymentsRes.data || [],
      };

      setGRNDetails(composed);
    } catch (err) {
      console.error('Error fetching GRN details:', err);
      setError('Failed to load GRN details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      received: 'bg-blue-100 text-blue-800 border-blue-200',
      accepted: 'bg-green-100 text-green-800 border-green-200',
      partially_received: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      rejected: 'bg-red-100 text-red-800 border-red-200'
    };
    return statusColors[status as keyof typeof statusColors] || statusColors.draft;
  };

  const calculateTotals = () => {
    if (!grnDetails?.grn_line_items) return { ordered: 0, received: 0, accepted: 0, rejected: 0 };
    
    return grnDetails.grn_line_items.reduce(
      (acc: any, item: any) => ({
        ordered: acc.ordered + (item.ordered_quantity || 0),
        received: acc.received + (item.received_quantity || 0),
        accepted: acc.accepted + (item.accepted_quantity || 0),
        rejected: acc.rejected + (item.rejected_quantity || 0),
      }),
      { ordered: 0, received: 0, accepted: 0, rejected: 0 }
    );
  };

  const calculatePaymentSummary = () => {
    if (!grnDetails?.payments) return { total: 0, received: 0, pending: 0 };
    
    const totalPayments = grnDetails.payments.reduce((sum: number, payment: any) => 
      sum + (payment.payment_status === 'completed' ? payment.amount : 0), 0
    );
    
    const totalAmount = grnDetails.total_amount || 0;
    return {
      total: totalAmount,
      received: totalPayments,
      pending: totalAmount - totalPayments
    };
  };

  const totals = calculateTotals();
  const paymentSummary = calculatePaymentSummary();

  

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-green-600" />
            GRN Details - {grnDetails?.grn_number || 'Loading...'}
          </DialogTitle>
          <DialogDescription>
            Complete goods receipt note information and item details
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex justify-center py-8">
            <div className="text-destructive">{error}</div>
          </div>
        ) : (loading || !grnDetails) ? (
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">Loading GRN details...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    GRN Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant="outline" className={getStatusColor(grnDetails?.status || '')}>
                      {grnDetails?.status?.replace('_', ' ')?.toUpperCase() || ''}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">GRN Date:</span>
                    <span className="text-sm font-medium">
                      {grnDetails?.grn_date ? format(new Date(grnDetails.grn_date), 'MMM dd, yyyy') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">PO Number:</span>
                    <span className="text-sm font-medium">{grnDetails?.purchase_order?.po_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Supplier Invoice:</span>
                    <span className="text-sm font-medium">{grnDetails?.supplier_invoice_number || 'N/A'}</span>
                  </div>
                  {grnDetails?.supplier_invoice_date && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Invoice Date:</span>
                      <span className="text-sm font-medium">
                        {format(new Date(grnDetails.supplier_invoice_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Supplier Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-sm font-medium">{grnDetails?.supplier?.name || grnDetails?.supplier_name || 'N/A'}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {grnDetails?.supplier?.email && (
                      <div>Email: {grnDetails.supplier.email}</div>
                    )}
                    {grnDetails?.supplier?.phone && (
                      <div>Phone: {grnDetails.supplier.phone}</div>
                    )}
                    {grnDetails?.supplier?.gst_number && (
                      <div>GST: {grnDetails.supplier.gst_number}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quantity Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Quantity Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{totals.ordered}</div>
                    <div className="text-sm text-blue-600">Total Ordered</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{totals.received}</div>
                    <div className="text-sm text-green-600">Total Received</div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-700">{totals.accepted}</div>
                    <div className="text-sm text-emerald-600">Total Accepted</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-700">{totals.rejected}</div>
                    <div className="text-sm text-red-600">Total Rejected</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Line Items</CardTitle>
                <CardDescription>
                  Detailed breakdown of received items with quantities and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>UoM</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Accepted</TableHead>
                        <TableHead className="text-right">Rejected</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grnDetails?.grn_line_items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.product?.name || item.product_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.product?.sku || item.product_sku}
                          </TableCell>
                          <TableCell>{item.unit_of_measure}</TableCell>
                          <TableCell className="text-right font-medium">
                            {item.ordered_quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.received_quantity > 0 ? 'text-blue-600 font-medium' : ''}>
                              {item.received_quantity || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.accepted_quantity > 0 ? 'text-green-600 font-medium' : ''}>
                              {item.accepted_quantity || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.rejected_quantity > 0 ? 'text-red-600 font-medium' : ''}>
                              {item.rejected_quantity || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            ₹{Number(item.unit_price).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{Number(item.line_total).toLocaleString('en-IN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subtotal:</span>
                    <span className="text-sm font-medium">
                      ₹{Number(grnDetails?.subtotal_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tax Amount:</span>
                    <span className="text-sm font-medium">
                      ₹{Number(grnDetails?.total_tax_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Discount:</span>
                    <span className="text-sm font-medium">
                      ₹{Number(grnDetails?.total_discount_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Total Amount:</span>
                    <span className="text-lg font-bold text-green-600">
                      ₹{Number(grnDetails?.total_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Payment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Amount:</span>
                    <span className="text-sm font-medium">
                      ₹{Number(paymentSummary.total).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Amount Paid:</span>
                    <span className="text-sm font-medium text-green-600">
                      ₹{Number(paymentSummary.received).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Pending Payment:</span>
                    <span className="text-lg font-bold text-orange-600">
                      ₹{Number(paymentSummary.pending).toLocaleString('en-IN')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {grnDetails?.remarks && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Remarks</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{grnDetails.remarks}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}