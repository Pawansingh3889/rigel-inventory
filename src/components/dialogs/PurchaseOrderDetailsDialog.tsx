import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Package, Building2, Calendar, DollarSign, Truck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PurchaseOrderDetailsProps {
  purchaseOrder: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseOrderDetailsDialog({ purchaseOrder, open, onOpenChange }: PurchaseOrderDetailsProps) {
  const [poDetails, setPODetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && purchaseOrder?.id) {
      fetchPODetails();
    }
  }, [open, purchaseOrder?.id]);

  const fetchPODetails = async () => {
    if (!purchaseOrder?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(*),
          purchase_order_items(
            *,
            product:products(name, sku, unit)
          )
        `)
        .eq('id', purchaseOrder.id)
        .single();

      if (error) throw error;
      setPODetails(data);
    } catch (error) {
      console.error('Error fetching PO details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200',
      open: 'bg-blue-100 text-blue-800 border-blue-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      partially_received: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      closed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return statusColors[status as keyof typeof statusColors] || statusColors.draft;
  };

  const calculateTotals = () => {
    if (!poDetails?.purchase_order_items) return { ordered: 0, received: 0, pending: 0 };
    
    return poDetails.purchase_order_items.reduce(
      (acc: any, item: any) => ({
        ordered: acc.ordered + (item.quantity || 0),
        received: acc.received + (item.received_quantity || 0),
        pending: acc.pending + (item.pending_quantity || 0),
      }),
      { ordered: 0, received: 0, pending: 0 }
    );
  };

  const totals = calculateTotals();

  if (!poDetails && !loading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Purchase Order Details - {poDetails?.po_number || 'Loading...'}
          </DialogTitle>
          <DialogDescription>
            Complete purchase order information and item details
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-muted-foreground">Loading purchase order details...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Order Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant="outline" className={getStatusColor(poDetails?.status || '')}>
                      {poDetails?.status?.replace('_', ' ')?.toUpperCase() || ''}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Order Date:</span>
                    <span className="text-sm font-medium">
                      {poDetails?.order_date ? format(new Date(poDetails.order_date), 'MMM dd, yyyy') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Expected Date:</span>
                    <span className="text-sm font-medium">
                      {poDetails?.expected_date ? format(new Date(poDetails.expected_date), 'MMM dd, yyyy') : 'Not specified'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Currency:</span>
                    <span className="text-sm font-medium">{poDetails?.currency || 'INR'}</span>
                  </div>
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
                    <span className="text-sm font-medium">{poDetails?.supplier?.name || 'N/A'}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {poDetails?.supplier?.email && (
                      <div>Email: {poDetails.supplier.email}</div>
                    )}
                    {poDetails?.supplier?.phone && (
                      <div>Phone: {poDetails.supplier.phone}</div>
                    )}
                    {poDetails?.supplier?.gst_number && (
                      <div>GST: {poDetails.supplier.gst_number}</div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{totals.ordered}</div>
                    <div className="text-sm text-blue-600">Total Ordered</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{totals.received}</div>
                    <div className="text-sm text-green-600">Total Received</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-700">{totals.pending}</div>
                    <div className="text-sm text-orange-600">Total Pending</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Line Items</CardTitle>
                <CardDescription>
                  Detailed breakdown of ordered items with quantities and status
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
                        <TableHead className="text-right">Ordered Qty</TableHead>
                        <TableHead className="text-right">Received Qty</TableHead>
                        <TableHead className="text-right">Pending Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poDetails?.purchase_order_items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.product?.name || item.item_description}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.product?.sku || item.item_code}
                          </TableCell>
                          <TableCell>{item.unit_of_measure}</TableCell>
                          <TableCell className="text-right font-medium">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.received_quantity > 0 ? 'text-green-600 font-medium' : ''}>
                              {item.received_quantity || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.pending_quantity > 0 ? 'text-orange-600 font-medium' : 'text-emerald-600'}>
                              {item.pending_quantity || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {poDetails.currency} {Number(item.unit_price).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {poDetails.currency} {Number(item.total_price).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
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
                    {poDetails?.currency} {Number(poDetails?.subtotal_amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tax Amount:</span>
                  <span className="text-sm font-medium">
                    {poDetails?.currency} {Number(poDetails?.total_tax_amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Discount:</span>
                  <span className="text-sm font-medium">
                    {poDetails?.currency} {Number(poDetails?.total_discount_amount || 0).toLocaleString()}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Total Amount:</span>
                  <span className="text-lg font-bold text-green-600">
                    {poDetails?.currency} {Number(poDetails?.total_amount || 0).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {poDetails?.notes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{poDetails.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}