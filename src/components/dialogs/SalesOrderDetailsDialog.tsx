
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';

interface SalesOrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  salesOrder: any;
  salesOrderItems: any[];
  customer: any;
}

export const SalesOrderDetailsDialog: React.FC<SalesOrderDetailsDialogProps> = ({
  isOpen,
  onClose,
  salesOrder,
  salesOrderItems,
  customer
}) => {
  if (!salesOrder) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      confirmed: 'default',
      in_progress: 'secondary',
      completed: 'default',
      cancelled: 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Sales Order Details
            {getStatusBadge(salesOrder.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Order Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Sales Order ID</div>
                  <div className="font-semibold">{salesOrder.order_number}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Order Date</div>
                  <div>{format(new Date(salesOrder.order_date), 'dd/MM/yyyy')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Customer PO No.</div>
                  <div>{salesOrder.customer_po_number || '-'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Customer Ref. No.</div>
                  <div>{salesOrder.customer_reference_no || '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Name</div>
                  <div className="font-semibold">{customer?.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Customer Reference</div>
                  <div>{customer?.customer_ref}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Email</div>
                  <div>{customer?.email || '-'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Phone</div>
                  <div>{customer?.phone || '-'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">GSTIN</div>
                  <div>{customer?.gstin || '-'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Contact Person</div>
                  <div>{customer?.contact_person || '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {salesOrderItems.map((item, index) => (
                  <div key={item.id || index} className="border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                      <div className="md:col-span-2">
                        <div className="text-sm font-medium text-muted-foreground">Item Description</div>
                        <div className="font-semibold">{item.item_description}</div>
                        {item.hsn_sac_code && (
                          <div className="text-sm text-muted-foreground">HSN: {item.hsn_sac_code}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Quantity</div>
                        <div>{item.quantity} {item.unit_of_measure}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Unit Price</div>
                        <div>₹{item.unit_price.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Discount</div>
                        <div>
                          {item.discount_percentage > 0 
                            ? `${item.discount_percentage}%` 
                            : `₹${item.discount_amount.toFixed(2)}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Total</div>
                        <div className="font-semibold">₹{item.total_price.toFixed(2)}</div>
                      </div>
                    </div>
                    
                    {/* Tax breakdown */}
                    <div className="mt-2 pt-2 border-t">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">CGST ({item.cgst_rate}%): </span>
                          <span>₹{item.cgst_amount.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SGST ({item.sgst_rate}%): </span>
                          <span>₹{item.sgst_amount.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">IGST ({item.igst_rate}%): </span>
                          <span>₹{item.igst_amount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivery Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Delivery Address</div>
                  <div>
                    {salesOrder.delivery_address_line1 && (
                      <>
                        {salesOrder.delivery_address_line1}<br />
                        {salesOrder.delivery_address_line2 && (
                          <>{salesOrder.delivery_address_line2}<br /></>
                        )}
                        {salesOrder.delivery_city}, {salesOrder.delivery_state} {salesOrder.delivery_pin_code}<br />
                        {salesOrder.delivery_country}
                      </>
                    )}
                    {salesOrder.same_as_registered_address && (
                      <Badge variant="outline" className="mt-1">Same as registered address</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Expected Delivery</div>
                  <div>
                    {salesOrder.expected_delivery_date 
                      ? format(new Date(salesOrder.expected_delivery_date), 'dd/MM/yyyy')
                      : '-'
                    }
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Mode of Transport</div>
                  <div className="capitalize">{salesOrder.mode_of_transport || '-'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Shipping Instructions</div>
                  <div>{salesOrder.shipping_instructions || '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment & Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment & Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Currency</div>
                      <div>{salesOrder.currency}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Payment Terms</div>
                      <div>{salesOrder.payment_terms || '-'}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>₹{salesOrder.subtotal_amount?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="text-red-600">-₹{salesOrder.discount_amount?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax:</span>
                      <span>₹{salesOrder.tax_amount?.toFixed(2) || '0.00'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Grand Total:</span>
                      <span className="text-green-600">₹{salesOrder.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {salesOrder.notes && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-muted-foreground">Notes</div>
                  <div className="mt-1 p-3 bg-muted/50 rounded-md">
                    {salesOrder.notes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
