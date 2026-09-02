import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  MapPin,
  User,
  Phone,
  Download,
  ChevronDown,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { WarehouseBinTableMobile } from './WarehouseBinTableMobile';
import { WarehouseBinForm } from '@/components/forms/WarehouseBinForm';
import * as XLSX from 'xlsx';

interface WarehouseBin {
  id: string;
  wh_bin_code: string;
  bin_name: string;
  warehouse_name?: string;
  warehouse_code?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
  is_active: boolean;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

interface WarehouseBinTableProps {
  refreshTrigger?: number;
  onEdit: (bin: WarehouseBin) => void;
  onDelete: (bin: WarehouseBin) => void;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

export const WarehouseBinTable: React.FC<WarehouseBinTableProps> = ({ refreshTrigger, onEdit, onDelete }) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingBin, setEditingBin] = useState<WarehouseBin | null>(null);
  const itemsPerPage = 10;

  // Use mobile component on small screens
  if (isMobile) {
    return (
      <WarehouseBinTableMobile
        refreshTrigger={refreshTrigger}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  useEffect(() => {
    fetchBins();

    // Set up real-time subscription
    const channel = supabase
      .channel('warehouse_bins_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warehouse_bins'
        },
        (payload) => {
          console.log('Warehouse bins change detected:', payload);
          fetchBins(); // Refresh the data
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBins = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching warehouse bins:', error);
        return;
      }

      setBins(data || []);
    } catch (error) {
      console.error('Error fetching warehouse bins:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRowExpansion = (binId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(binId)) {
      newExpanded.delete(binId);
    } else {
      newExpanded.add(binId);
    }
    setExpandedRows(newExpanded);
  };

  // Sort function
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  // Enhanced search and sort functionality
  const filteredBins = useMemo(() => {
    let filtered = bins.filter(bin =>
      (bin.wh_bin_code?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (bin.bin_name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (bin.warehouse_name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (bin.warehouse_code?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (bin.city?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (bin.contact_person_name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())
    );

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'warehouse_name':
            aValue = a.warehouse_name || '';
            bValue = b.warehouse_name || '';
            break;
          case 'warehouse_code':
            aValue = a.warehouse_code || '';
            bValue = b.warehouse_code || '';
            break;
          case 'wh_bin_code':
            aValue = a.wh_bin_code ?? '';
            bValue = b.wh_bin_code ?? '';
            break;
          case 'bin_name':
            aValue = a.bin_name ?? '';
            bValue = b.bin_name ?? '';
            break;
          case 'is_active':
            aValue = a.is_active;
            bValue = b.is_active;
            break;
          case 'created_at':
            aValue = new Date(a.created_at);
            bValue = new Date(b.created_at);
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [bins, searchTerm, sortConfig]);

  // Reset to first page when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredBins.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBins = filteredBins.slice(startIndex, endIndex);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToPrevious = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const goToNext = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const handleEditBin = (bin: WarehouseBin) => {
    setEditingBin(bin);
    setShowEditDialog(true);
  };

  const handleDeleteBin = async (binId: string) => {
    if (!window.confirm('Are you sure you want to delete this warehouse and BIN location?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('warehouse_bins')
        .delete()
        .eq('id', binId);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Warehouse and BIN location deleted successfully",
      });

      fetchBins();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete warehouse and BIN location",
        variant: "destructive",
      });
    }
  };

  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredBins.map(bin => ({
        'Warehouse Name': bin.warehouse_name || '',
        'Warehouse Code': bin.warehouse_code || '',
        'BIN Code': bin.wh_bin_code,
        'BIN Name': bin.bin_name,
        'Address Line 1': bin.address_line1 || '',
        'Address Line 2': bin.address_line2 || '',
        'City': bin.city || '',
        'State': bin.state || '',
        'Country': bin.country || '',
        'PIN Code': bin.postal_code || '',
        'Contact Person': bin.contact_person_name || '',
        'Contact Phone': bin.contact_person_phone || '',
        'Status': bin.is_active ? 'Active' : 'Inactive',
        'Created Date': new Date(bin.created_at).toLocaleDateString('en-IN'),
        'Last Updated': new Date(bin.updated_at).toLocaleDateString('en-IN')
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Warehouse_Locations');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Warehouse_BIN_Locations_${currentDate}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Successful",
        description: `${filteredBins.length} warehouse locations exported to ${filename}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting the data",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Export Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search warehouses and bins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={exportToExcel} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Enhanced Table with Expandable Rows */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12"></TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('warehouse_name')}
              >
                <div className="flex items-center gap-2">
                  Warehouse Name
                  {getSortIcon('warehouse_name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('warehouse_code')}
              >
                <div className="flex items-center gap-2">
                  Warehouse Code
                  {getSortIcon('warehouse_code')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('wh_bin_code')}
              >
                <div className="flex items-center gap-2">
                  BIN Code
                  {getSortIcon('wh_bin_code')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('bin_name')}
              >
                <div className="flex items-center gap-2">
                  BIN Name
                  {getSortIcon('bin_name')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('is_active')}
              >
                <div className="flex items-center gap-2">
                  Status
                  {getSortIcon('is_active')}
                </div>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentBins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-12 w-12 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium text-muted-foreground">
                      {searchTerm ? 'No warehouses found' : 'No warehouse locations created'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {searchTerm ? 'Try adjusting your search terms.' : 'Create your first warehouse and BIN location to get started.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              currentBins.map((bin) => (
                <React.Fragment key={bin.id}>
                  <TableRow className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(bin.id)}
                        className="h-6 w-6 p-0"
                      >
                        {expandedRows.has(bin.id) ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRightIcon className="h-4 w-4" />
                        }
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {bin.warehouse_name || '-'}
                    </TableCell>
                    <TableCell className="font-mono">
                      {bin.warehouse_code || '-'}
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-primary">
                      {bin.wh_bin_code}
                    </TableCell>
                    <TableCell className="font-medium">
                      {bin.bin_name}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={bin.is_active ? "default" : "secondary"}
                        className={bin.is_active ? "bg-green-100 text-green-800 border-green-200" : ""}
                      >
                        {bin.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditBin(bin)}
                          className="hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBin(bin.id)}
                          className="hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                   {/* Expanded Row Content */}
                   {expandedRows.has(bin.id) && (
                     <TableRow>
                       <TableCell colSpan={7} className="bg-muted/25 p-0">
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Address Information */}
                          {(bin.address_line1 || bin.city || bin.state || bin.country) && (
                            <Card className="border-l-4 border-l-blue-500">
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                  <MapPin className="h-4 w-4" />
                                  Address
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-1 text-sm">
                                {bin.address_line1 && <p>{bin.address_line1}</p>}
                                {bin.address_line2 && <p>{bin.address_line2}</p>}
                                <p>
                                  {[bin.city, bin.state, bin.postal_code].filter(Boolean).join(', ')}
                                </p>
                                {bin.country && <p>{bin.country}</p>}
                              </CardContent>
                            </Card>
                          )}

                          {/* Contact Information */}
                          {(bin.contact_person_name || bin.contact_person_phone) && (
                            <Card className="border-l-4 border-l-green-500">
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-sm">
                                  <User className="h-4 w-4" />
                                  Contact
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2 text-sm">
                                {bin.contact_person_name && (
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span>{bin.contact_person_name}</span>
                                  </div>
                                )}
                                {bin.contact_person_phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    <span>{bin.contact_person_phone}</span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )}

                          {/* Metadata */}
                          <Card className="border-l-4 border-l-purple-500">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Created:</span>
                                <p>{new Date(bin.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Updated:</span>
                                <p>{new Date(bin.updated_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}</p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-muted/25 p-4 rounded-lg">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
            <span className="font-medium">{Math.min(endIndex, filteredBins.length)}</span> of{' '}
            <span className="font-medium">{filteredBins.length}</span> warehouse locations
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {getPageNumbers().map((page, index) => (
                <React.Fragment key={index}>
                  {page === '...' ? (
                    <span className="px-2 py-1 text-sm text-muted-foreground">...</span>
                  ) : (
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(page as number)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  )}
                </React.Fragment>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <WarehouseBinForm
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => {
          fetchBins();
          setEditingBin(null);
        }}
        editingBin={editingBin}
      />
    </div>
  );
}