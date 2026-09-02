
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Edit, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, FileText } from "lucide-react";
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { useIsMobile } from '@/hooks/use-mobile';
import { SalesOrderTableMobile } from './SalesOrderTableMobile';

interface SalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  customer_id: string;
  customer_name?: string;
  customer_ref?: string;
  customer_po_number?: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  total_ordered_qty: number;
  total_invoiced_qty: number;
  total_backorder_qty: number;
  delivery_status: string;
}

interface SalesOrderTableProps {
  salesOrders: SalesOrder[];
  onView: (salesOrder: SalesOrder) => void;
  onEdit: (salesOrder: SalesOrder) => void;
  onDelete: (salesOrder: SalesOrder) => void;
  onDownloadExcel?: (salesOrder: SalesOrder) => void;
  onDownloadPDF?: (salesOrder: SalesOrder) => void;
  loading?: boolean;
}

type SortField = 'order_number' | 'customer_name' | 'order_date' | 'total_amount' | 'status' | 'delivery_status' | 'total_ordered_qty' | 'total_invoiced_qty' | 'total_backorder_qty';
type SortDirection = 'asc' | 'desc';

export const SalesOrderTable: React.FC<SalesOrderTableProps> = ({
  salesOrders,
  onView,
  onEdit,
  onDelete,
  onDownloadExcel,
  onDownloadPDF,
  loading = false
}) => {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const itemsPerPage = 5;

  // Mobile view
  if (isMobile) {
    return (
      <SalesOrderTableMobile
        salesOrders={salesOrders}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        loading={loading}
      />
    );
  }

  // Filter sales orders based on search term
  const filteredOrders = salesOrders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(searchLower) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchLower)) ||
      (order.customer_po_number && order.customer_po_number.toLowerCase().includes(searchLower)) ||
      order.status.toLowerCase().includes(searchLower) ||
      order.delivery_status.toLowerCase().includes(searchLower)
    );
  });

  // Sort filtered orders
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortField) {
      case 'order_number':
        aValue = a.order_number;
        bValue = b.order_number;
        break;
      case 'customer_name':
        aValue = a.customer_name || '';
        bValue = b.customer_name || '';
        break;
      case 'order_date':
        aValue = new Date(a.order_date);
        bValue = new Date(b.order_date);
        break;
      case 'total_amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'delivery_status':
        aValue = a.delivery_status;
        bValue = b.delivery_status;
        break;
      case 'total_ordered_qty':
        aValue = a.total_ordered_qty;
        bValue = b.total_ordered_qty;
        break;
      case 'total_invoiced_qty':
        aValue = a.total_invoiced_qty;
        bValue = b.total_invoiced_qty;
        break;
      case 'total_backorder_qty':
        aValue = a.total_backorder_qty;
        bValue = b.total_backorder_qty;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate sorted orders
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = sortedOrders.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

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

  const getDeliveryStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      not_started: 'outline',
      partially_delivered: 'secondary',
      closed: 'default'
    };

    const labels: Record<string, string> = {
      not_started: 'Not Started',
      partially_delivered: 'Partially Delivered',
      closed: 'Closed'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const handleDownloadExcel = (order: SalesOrder) => {
    if (onDownloadExcel) return onDownloadExcel(order);
    const data = [
      {
        'Order No.': order.order_number,
        'Order Date': format(new Date(order.order_date), 'yyyy-MM-dd'),
        Customer: order.customer_name || '',
        'PO Number': order.customer_po_number || '-',
        'Ordered Qty': order.total_ordered_qty,
        'Invoiced Qty': order.total_invoiced_qty,
        'Backorder Qty': order.total_backorder_qty,
        Status: order.status,
        'Delivery Status': order.delivery_status,
        'Total Amount': order.total_amount,
        Currency: order.currency,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Order');
    XLSX.writeFile(wb, `${order.order_number || 'sales-order'}.xlsx`);
  };

  const handleDownloadPDF = (order: SalesOrder) => {
    if (onDownloadPDF) return onDownloadPDF(order);
    const doc = new jsPDF();
    let y = 14;
    doc.setFontSize(14);
    doc.text('Sales Order', 14, y);
    y += 8;
    doc.setFontSize(11);
    const lines = [
      `Order No.: ${order.order_number}`,
      `Order Date: ${format(new Date(order.order_date), 'dd/MM/yyyy')}`,
      `Customer: ${order.customer_name || ''}`,
      `PO Number: ${order.customer_po_number || '-'}`,
      `Ordered Qty: ${order.total_ordered_qty}`,
      `Invoiced Qty: ${order.total_invoiced_qty}`,
      `Backorder Qty: ${order.total_backorder_qty}`,
      `Status: ${order.status}`,
      `Delivery Status: ${order.delivery_status}`,
      `Total Amount: ${order.currency} ${order.total_amount.toFixed(2)}`,
    ];
    lines.forEach((l) => { doc.text(l, 14, y); y += 7; });
    doc.save(`${order.order_number || 'sales-order'}.pdf`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Sales Orders</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by order no, customer, PO number, status..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                className="pl-10 w-80"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading sales orders...</div>
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="text-center p-8">
            <div className="text-muted-foreground">
              {searchTerm ? 'No sales orders found matching your search.' : 'No sales orders yet.'}
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('order_number')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Order No.</span>
                      {getSortIcon('order_number')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('order_date')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Order Date</span>
                      {getSortIcon('order_date')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('customer_name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Customer</span>
                      {getSortIcon('customer_name')}
                    </div>
                  </TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort('total_ordered_qty')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Ordered Qty</span>
                      {getSortIcon('total_ordered_qty')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort('total_invoiced_qty')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Invoiced Qty</span>
                      {getSortIcon('total_invoiced_qty')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-center"
                    onClick={() => handleSort('total_backorder_qty')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Backorder Qty</span>
                      {getSortIcon('total_backorder_qty')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('delivery_status')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Delivery Status</span>
                      {getSortIcon('delivery_status')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right"
                    onClick={() => handleSort('total_amount')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Total Amount</span>
                      {getSortIcon('total_amount')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.order_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer_ref}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.customer_po_number || '-'}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {order.total_ordered_qty}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {order.total_invoiced_qty}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {order.total_backorder_qty}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
                    </TableCell>
                    <TableCell>
                      {getDeliveryStatusBadge(order.delivery_status)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.currency} {order.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(order)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(order)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadExcel(order)}
                          title="Download Excel"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPDF(order)}
                          title="Download PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(order)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedOrders.length)} of {sortedOrders.length} entries
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
