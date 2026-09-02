import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { FileText, Building2, Calendar, DollarSign, MapPin, User } from 'lucide-react';

interface SalesInvoiceDetailsProps {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SalesInvoiceDetailsDialog({ invoiceId, open, onOpenChange }: SalesInvoiceDetailsProps) {
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoiceDetails();
    }
  }, [open, invoiceId]);

  const fetchInvoiceDetails = async () => {
    if (!invoiceId) return;

    try {
      setLoading(true);
      setError(null);

      // 1) Fetch header only
      const { data: header, error: headerError } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('id', invoiceId)
        .maybeSingle();
      if (headerError) throw headerError;
      if (!header) throw new Error('Invoice not found');

      // 2) Fetch related records separately (avoid relationship joins)
      const [itemsRes, paymentsRes, customerRes, soRes] = await Promise.all([
        supabase.from('sales_invoice_items').select('*').eq('sales_invoice_id', invoiceId),
        supabase.from('payments').select('amount, payment_date, payment_method, payment_status').eq('sales_invoice_id', invoiceId),
        header.customer_id
          ? supabase.from('customers').select('*').eq('id', header.customer_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        header.sales_order_id
          ? supabase.from('sales_orders').select('order_number, order_date').eq('id', header.sales_order_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const composed = {
        ...header,
        customer: customerRes.data || null,
        sales_order: soRes.data || null,
        sales_invoice_items: itemsRes.data || [],
        payments: paymentsRes.data || [],
      };

      setInvoiceDetails(composed);
    } catch (err) {
      console.error('Error fetching sales invoice details:', err);
      setError('Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      finalized: 'bg-green-100 text-green-800 border-green-200',
      sent: 'bg-blue-100 text-blue-800 border-blue-200',
      paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      overdue: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return statusColors[status as keyof typeof statusColors] || statusColors.draft;
  };

  const calculateTotals = () => {
    if (!invoiceDetails?.sales_invoice_items) return { ordered: 0, invoiced: 0, backorder: 0 };
    
    return invoiceDetails.sales_invoice_items.reduce(
      (acc: any, item: any) => ({
        ordered: acc.ordered + (item.quantity_ordered || 0),
        invoiced: acc.invoiced + (item.quantity_invoiced || 0),
        backorder: acc.backorder + (item.backorder_quantity || 0),
      }),
      { ordered: 0, invoiced: 0, backorder: 0 }
    );
  };

  const calculatePaymentSummary = () => {
    if (!invoiceDetails?.payments) return { total: 0, received: 0, pending: 0 };
    
    const totalPayments = invoiceDetails.payments.reduce((sum: number, payment: any) => 
      sum + (payment.payment_status === 'completed' ? payment.amount : 0), 0
    );
    
    const totalAmount = invoiceDetails.total_amount || 0;
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
            <FileText className="h-5 w-5 text-blue-600" />
            Sales Invoice Details - {invoiceDetails?.invoice_number || 'Loading...'}
          </DialogTitle>
          <DialogDescription>
            Complete sales invoice information and item details
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex justify-center py-8">
            <div className="text-destructive">{error}</div>
          </div>
        ) : (loading || !invoiceDetails) ? (
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">Loading invoice details...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Invoice Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant="outline" className={getStatusColor(invoiceDetails?.status || '')}>
                      {invoiceDetails?.status?.replace('_', ' ')?.toUpperCase() || ''}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Invoice Date:</span>
                    <span className="text-sm font-medium">
                      {invoiceDetails?.invoice_date ? format(new Date(invoiceDetails.invoice_date), 'MMM dd, yyyy') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Due Date:</span>
                    <span className="text-sm font-medium">
                      {invoiceDetails?.due_date ? format(new Date(invoiceDetails.due_date), 'MMM dd, yyyy') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">SO Number:</span>
                    <span className="text-sm font-medium">{invoiceDetails?.sales_order?.order_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Currency:</span>
                    <span className="text-sm font-medium">{invoiceDetails?.currency || 'INR'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-sm font-medium">{invoiceDetails?.customer?.name || invoiceDetails?.customer_name || 'N/A'}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {invoiceDetails?.customer?.email && (
                      <div>Email: {invoiceDetails.customer.email}</div>
                    )}
                    {invoiceDetails?.customer?.phone && (
                      <div>Phone: {invoiceDetails.customer.phone}</div>
                    )}
                    {invoiceDetails?.customer?.gstin && (
                      <div>GSTIN: {invoiceDetails.customer.gstin}</div>
                    )}
                    {invoiceDetails?.customer?.customer_ref && (
                      <div>Ref: {invoiceDetails.customer.customer_ref}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Billing Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {invoiceDetails?.billing_address_line1 && (
                      <>
                        {invoiceDetails.billing_address_line1}<br />
                        {invoiceDetails.billing_address_line2 && <>{invoiceDetails.billing_address_line2}<br /></>}
                        {invoiceDetails.billing_city}, {invoiceDetails.billing_state} {invoiceDetails.billing_pin_code}<br />
                        {invoiceDetails.billing_country}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {invoiceDetails?.same_as_billing_address ? (
                      <Badge variant="outline">Same as billing address</Badge>
                    ) : (
                      <>
                        {invoiceDetails?.shipping_address_line1 && (
                          <>
                            {invoiceDetails.shipping_address_line1}<br />
                            {invoiceDetails.shipping_address_line2 && <>{invoiceDetails.shipping_address_line2}<br /></>}
                            {invoiceDetails.shipping_city}, {invoiceDetails.shipping_state} {invoiceDetails.shipping_pin_code}<br />
                            {invoiceDetails.shipping_country}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quantity Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Quantity Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{totals.ordered}</div>
                    <div className="text-sm text-blue-600">Total Ordered</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{totals.invoiced}</div>
                    <div className="text-sm text-green-600">Total Invoiced</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-700">{totals.backorder}</div>
                    <div className="text-sm text-orange-600">Total Backorder</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Line Items</CardTitle>
                <CardDescription>
                  Detailed breakdown of invoiced items with quantities and pricing
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
                        <TableHead className="text-right">Invoiced</TableHead>
                        <TableHead className="text-right">Backorder</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceDetails?.sales_invoice_items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.product?.name || item.item_description}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.product?.sku || item.item_code}
                          </TableCell>
                          <TableCell>{item.unit_of_measure}</TableCell>
                          <TableCell className="text-right font-medium">
                            {item.quantity_ordered}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.quantity_invoiced > 0 ? 'text-green-600 font-medium' : ''}>
                              {item.quantity_invoiced || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.backorder_quantity > 0 ? 'text-orange-600 font-medium' : ''}>
                              {item.backorder_quantity || 0}
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
                      ₹{Number(invoiceDetails?.subtotal_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tax Amount:</span>
                    <span className="text-sm font-medium">
                      ₹{Number(invoiceDetails?.tax_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Discount:</span>
                    <span className="text-sm font-medium">
                      ₹{Number(invoiceDetails?.discount_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {invoiceDetails?.freight_charges > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Freight:</span>
                      <span className="text-sm font-medium">
                        ₹{Number(invoiceDetails.freight_charges).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {invoiceDetails?.packing_charges > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Packing:</span>
                      <span className="text-sm font-medium">
                        ₹{Number(invoiceDetails.packing_charges).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Total Amount:</span>
                    <span className="text-lg font-bold text-green-600">
                      ₹{Number(invoiceDetails?.total_amount || 0).toLocaleString('en-IN')}
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
                    <span className="text-sm text-muted-foreground">Amount Received:</span>
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

            {invoiceDetails?.notes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{invoiceDetails.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}