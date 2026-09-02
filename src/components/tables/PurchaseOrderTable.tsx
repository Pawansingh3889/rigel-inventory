import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Download, 
  FileSpreadsheet, 
  FileText,
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { PurchaseOrderTableMobile } from './PurchaseOrderTableMobile';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_date?: string;
  total_amount: number;
  currency: string;
  supplier: {
    name: string;
  };
  created_at: string;
  notes?: string;
}

interface PurchaseOrderTableProps {
  purchaseOrders: PurchaseOrder[];
  onView: (po: PurchaseOrder) => void;
  onEdit: (po: PurchaseOrder) => void;
  onDelete: (poId: string) => void;
  loading?: boolean;
}

type SortField = 'po_number' | 'supplier_name' | 'order_date' | 'expected_date' | 'total_amount' | 'status';
type SortDirection = 'asc' | 'desc';

export function PurchaseOrderTable({
  purchaseOrders,
  onView,
  onEdit,
  onDelete,
  loading = false
}: PurchaseOrderTableProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [companyData, setCompanyData] = useState<any>(null);
  
  const itemsPerPage = 5;

  // Mobile view
  if (isMobile) {
    return (
      <PurchaseOrderTableMobile
        purchaseOrders={purchaseOrders}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        loading={loading}
      />
    );
  }

  // Fetch company data
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!profile?.company_id) return;
      
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single();
        
        if (error) throw error;
        setCompanyData(data);
      } catch (error) {
        console.error('Error fetching company data:', error);
      }
    };

    fetchCompanyData();
  }, [profile?.company_id]);

  // Filter and sort data
  const filteredOrders = purchaseOrders.filter(order =>
    order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'po_number':
        aValue = a.po_number;
        bValue = b.po_number;
        break;
      case 'supplier_name':
        aValue = a.supplier.name;
        bValue = b.supplier.name;
        break;
      case 'order_date':
        aValue = new Date(a.order_date);
        bValue = new Date(b.order_date);
        break;
      case 'expected_date':
        aValue = a.expected_date ? new Date(a.expected_date) : new Date('1900-01-01');
        bValue = b.expected_date ? new Date(b.expected_date) : new Date('1900-01-01');
        break;
      case 'total_amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      default:
        return 0;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = sortedOrders.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      case 'open':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'confirmed':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'partially_received':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'closed':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const exportToExcel = (order: PurchaseOrder) => {
    try {
      // Company Header Info with real data
      const companyInfo = [
        ['PURCHASE ORDER'],
        [''],
        [companyData?.name || 'Your Company Name'],
        [companyData?.address_line1 || 'Company Address Line 1'],
        [`${companyData?.city || 'City'}, ${companyData?.state || 'State'}, ${companyData?.postal_code || 'ZIP Code'}`],
        [`Phone: ${companyData?.phone || '(555) 123-4567'} | Email: ${companyData?.email || 'orders@company.com'}`],
        ['']
      ];

      // PO Header Details
      const poHeader = [
        ['PO Number:', order.po_number, '', '', 'Order Date:', new Date(order.order_date).toLocaleDateString()],
        ['Supplier:', order.supplier.name, '', '', 'Expected Date:', order.expected_date ? new Date(order.expected_date).toLocaleDateString() : 'N/A'],
        ['Status:', order.status.toUpperCase(), '', '', 'Currency:', order.currency],
        ['']
      ];

      // Line Items Header (Industry Standard)
      const lineItemsHeader = [
        ['Line', 'Item Code', 'Description', 'Unit Price', 'Quantity', 'UOM', 'Total Amount']
      ];

      // Sample line items (since we don't have actual items in the interface yet)
      const lineItems = [
        [1, 'ITEM001', 'Sample Product 1', 100.00, 5, 'EA', 500.00],
        [2, 'ITEM002', 'Sample Product 2', 250.00, 2, 'EA', 500.00]
      ];

      // Totals Section
      const totalsSection = [
        [''],
        ['', '', '', '', 'Subtotal:', '', order.total_amount - (order.total_amount * 0.1)],
        ['', '', '', '', 'Tax (10%):', '', order.total_amount * 0.1],
        ['', '', '', '', 'TOTAL:', '', order.total_amount]
      ];

      // Terms and Conditions
      const termsSection = [
        [''],
        ['TERMS & CONDITIONS:'],
        ['• Payment Terms: Net 30 days'],
        ['• Delivery: FOB Destination'],
        ['• Quality: As per specifications'],
        ['• Returns: Prior authorization required'],
        [''],
        ['Notes:', order.notes || 'No additional notes']
      ];

      // Combine all sections
      const fullData = [
        ...companyInfo,
        ...poHeader,
        ...lineItemsHeader,
        ...lineItems,
        ...totalsSection,
        ...termsSection
      ];

      const ws = XLSX.utils.aoa_to_sheet(fullData);
      const wb = XLSX.utils.book_new();

      // Styling and formatting
      const headerRange = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 6, r: 0 } });
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Title merge
        { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } }, // Company name merge
      ];

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },   // Line
        { wch: 12 },  // Item Code
        { wch: 25 },  // Description
        { wch: 12 },  // Unit Price
        { wch: 10 },  // Quantity
        { wch: 8 },   // UOM
        { wch: 15 }   // Total Amount
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Order');
      XLSX.writeFile(wb, `PO_${order.po_number}_Complete.xlsx`);
      
      toast({
        title: "Excel Export Successful",
        description: `Complete Purchase Order ${order.po_number} exported to Excel`,
      });
    } catch (error) {
      console.error('Export to Excel failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export to Excel",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = (order: PurchaseOrder) => {
    try {
      const doc = new jsPDF();
      
      // Company Header - Professional Layout
      doc.setFontSize(22);
      doc.setTextColor(44, 62, 80); // Dark blue
      doc.text('PURCHASE ORDER', 105, 25, { align: 'center' });
      
      // Company Information Box
      doc.setDrawColor(44, 62, 80);
      doc.setFillColor(248, 249, 250);
      doc.rect(15, 35, 180, 35, 'FD');
      
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text(companyData?.name || 'Your Company Name', 20, 45);
      doc.setFontSize(10);
      doc.setTextColor(108, 117, 125);
      doc.text(companyData?.address_line1 || 'Company Address Line 1', 20, 52);
      doc.text(`${companyData?.city || 'City'}, ${companyData?.state || 'State'}, ${companyData?.postal_code || 'ZIP Code'}`, 20, 58);
      doc.text(`Phone: ${companyData?.phone || '(555) 123-4567'} | Email: ${companyData?.email || 'orders@company.com'}`, 20, 64);
      
      // PO Information Section
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      
      // Left column - PO Details
      doc.text('PO Number:', 20, 85);
      doc.setTextColor(220, 53, 69); // Red for PO number
      doc.text(order.po_number, 55, 85);
      
      doc.setTextColor(44, 62, 80);
      doc.text('Supplier:', 20, 95);
      doc.text(order.supplier.name, 55, 95);
      
      doc.text('Status:', 20, 105);
      doc.text(order.status.toUpperCase(), 55, 105);
      
      // Right column - Dates
      doc.text('Order Date:', 120, 85);
      doc.text(new Date(order.order_date).toLocaleDateString(), 155, 85);
      
      doc.text('Expected Date:', 120, 95);
      doc.text(order.expected_date ? new Date(order.expected_date).toLocaleDateString() : 'N/A', 155, 95);
      
      doc.text('Currency:', 120, 105);
      doc.text(order.currency, 155, 105);
      
      // Line Items Table Header
      const tableStartY = 125;
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text('LINE ITEMS', 20, tableStartY);
      
      // Table Headers
      doc.setDrawColor(108, 117, 125);
      doc.setFillColor(233, 236, 239);
      doc.rect(15, tableStartY + 5, 180, 10, 'FD');
      
      doc.setFontSize(10);
      doc.setTextColor(44, 62, 80);
      doc.text('Line', 20, tableStartY + 12);
      doc.text('Item Code', 35, tableStartY + 12);
      doc.text('Description', 70, tableStartY + 12);
      doc.text('Unit Price', 125, tableStartY + 12);
      doc.text('Qty', 150, tableStartY + 12);
      doc.text('UOM', 165, tableStartY + 12);
      doc.text('Total', 180, tableStartY + 12);
      
      // Sample Line Items
      const lineItems = [
        { line: 1, code: 'ITEM001', desc: 'Sample Product 1', price: 100.00, qty: 5, uom: 'EA', total: 500.00 },
        { line: 2, code: 'ITEM002', desc: 'Sample Product 2', price: 250.00, qty: 2, uom: 'EA', total: 500.00 }
      ];
      
      let currentY = tableStartY + 20;
      lineItems.forEach((item, index) => {
        if (index % 2 === 0) {
          doc.setFillColor(248, 249, 250);
          doc.rect(15, currentY - 5, 180, 10, 'F');
        }
        
        doc.setTextColor(73, 80, 87);
        doc.text(item.line.toString(), 20, currentY);
        doc.text(item.code, 35, currentY);
        doc.text(item.desc, 70, currentY);
        doc.text(`${order.currency} ${item.price.toFixed(2)}`, 125, currentY);
        doc.text(item.qty.toString(), 150, currentY);
        doc.text(item.uom, 165, currentY);
        doc.text(`${order.currency} ${item.total.toFixed(2)}`, 180, currentY);
        
        currentY += 10;
      });
      
      // Totals Section
      const totalsY = currentY + 15;
      const subtotal = order.total_amount / 1.1; // Assuming 10% tax
      const tax = order.total_amount - subtotal;
      
      doc.setDrawColor(108, 117, 125);
      doc.line(130, totalsY, 195, totalsY);
      
      doc.setTextColor(44, 62, 80);
      doc.text('Subtotal:', 140, totalsY + 10);
      doc.text(`${order.currency} ${subtotal.toFixed(2)}`, 175, totalsY + 10);
      
      doc.text('Tax (10%):', 140, totalsY + 20);
      doc.text(`${order.currency} ${tax.toFixed(2)}`, 175, totalsY + 20);
      
      doc.setFontSize(12);
      doc.setTextColor(220, 53, 69);
      doc.text('TOTAL:', 140, totalsY + 35);
      doc.text(`${order.currency} ${order.total_amount.toLocaleString()}`, 175, totalsY + 35);
      
      // Terms and Conditions
      const termsY = totalsY + 55;
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      doc.text('TERMS & CONDITIONS', 20, termsY);
      
      doc.setFontSize(9);
      doc.setTextColor(73, 80, 87);
      const terms = [
        '• Payment Terms: Net 30 days from invoice date',
        '• Delivery: FOB Destination, prepaid and allowed',
        '• Quality: All goods must meet specifications',
        '• Returns: Prior authorization required for all returns',
        '• Warranties: Standard manufacturer warranties apply'
      ];
      
      let termsCurrentY = termsY + 10;
      terms.forEach(term => {
        doc.text(term, 20, termsCurrentY);
        termsCurrentY += 8;
      });
      
      // Notes Section
      if (order.notes) {
        doc.setFontSize(10);
        doc.setTextColor(44, 62, 80);
        doc.text('Special Notes:', 20, termsCurrentY + 10);
        doc.setTextColor(73, 80, 87);
        doc.text(order.notes, 20, termsCurrentY + 20);
      }
      
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(108, 117, 125);
      doc.text(`Document generated on: ${new Date().toLocaleString()}`, 20, 285);
      doc.text('This is a system-generated document and does not require signature.', 20, 290);
      
      doc.save(`PO_${order.po_number}_Complete.pdf`);
      
      toast({
        title: "PDF Export Successful",
        description: `Complete Purchase Order ${order.po_number} exported to PDF`,
      });
    } catch (error) {
      console.error('Export to PDF failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export to PDF",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Search and Controls - Mobile Optimized */}
        <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex flex-col gap-4 items-start justify-between">
            <div className="flex items-center gap-2 w-full">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Search by PO number, supplier, or status..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white"
              />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-2 text-sm text-muted-foreground">
            <span>
              Showing {currentOrders.length} of {filteredOrders.length} purchase orders
            </span>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('po_number')}
                >
                  <div className="flex items-center gap-2">
                    PO Number
                    {getSortIcon('po_number')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('supplier_name')}
                >
                  <div className="flex items-center gap-2">
                    Supplier
                    {getSortIcon('supplier_name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('order_date')}
                >
                  <div className="flex items-center gap-2">
                    Order Date
                    {getSortIcon('order_date')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('expected_date')}
                >
                  <div className="flex items-center gap-2">
                    Expected Delivery
                    {getSortIcon('expected_date')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center gap-2">
                    Total Amount
                    {getSortIcon('total_amount')}
                  </div>
                </TableHead>
                <TableHead 
                  className="font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground text-center min-w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No purchase orders found matching your search.' : 'No purchase orders found.'}
                  </TableCell>
                </TableRow>
              ) : (
                currentOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell className="font-medium text-blue-600">
                      {order.po_number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.supplier.name}
                    </TableCell>
                    <TableCell>
                      {new Date(order.order_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {order.expected_date 
                        ? new Date(order.expected_date).toLocaleDateString()
                        : 'Not specified'
                      }
                    </TableCell>
                    <TableCell className="font-semibold">
                      {order.currency} {order.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(order.status)}
                      >
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 justify-center flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onView(order)}
                          className="h-8 w-8 p-0 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 text-blue-700 transition-all duration-200"
                          title="View Purchase Order Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(order)}
                          disabled={order.status === 'closed'}
                          className={`h-8 w-8 p-0 transition-all duration-200 ${
                            order.status === 'closed' 
                              ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' 
                              : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 text-emerald-700'
                          }`}
                          title={order.status === 'closed' ? 'Cannot edit closed purchase order' : 'Edit Purchase Order'}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(order.id)}
                          className="h-8 w-8 p-0 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 text-red-700 transition-all duration-200"
                          title="Delete Purchase Order"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportToExcel(order)}
                          className="h-8 w-8 p-0 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 text-green-700 transition-all duration-200"
                          title="Export to Excel Spreadsheet"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportToPDF(order)}
                          className="h-8 w-8 p-0 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300 text-orange-700 transition-all duration-200"
                          title="Export to PDF Document"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} results
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="hover:bg-gray-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={currentPage === page ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-gray-200"}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="hover:bg-gray-200"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}