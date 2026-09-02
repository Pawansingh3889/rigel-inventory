import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Edit, Trash2, Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';

interface Supplier {
  id: string;
  supplier_ref?: string;
  name: string;
  supplier_type?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
  gst_number?: string;
  preferred_currency?: string;
  payment_terms?: string;
  is_active: boolean;
  created_at: string;
}

interface SupplierTableProps {
  suppliers: Supplier[];
  onView: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  loading?: boolean;
}

export const SupplierTable: React.FC<SupplierTableProps> = ({
  suppliers,
  onView,
  onEdit,
  onDelete,
  onCreate,
  loading = false,
}) => {
  const { hasEditAccess } = useBusinessAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Manufacturer' | 'Distributor' | 'Service Provider' | 'Other'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  const canEdit = hasEditAccess('purchase');

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = !searchTerm || 
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.supplier_ref?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.gst_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && supplier.is_active) ||
      (statusFilter === 'inactive' && !supplier.is_active);
    
    const matchesType = typeFilter === 'all' || supplier.supplier_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by supplier name or GST number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Manufacturer">Manufacturer</SelectItem>
              <SelectItem value="Distributor">Distributor</SelectItem>
              <SelectItem value="Service Provider">Service Provider</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' 
                        ? 'No suppliers match your filters'
                        : 'No suppliers found. Add your first supplier to get started.'
                      }
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedSuppliers.map((supplier) => (
                  <TableRow key={supplier.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="font-mono text-sm">
                        {supplier.supplier_ref || 'Auto-generated'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.contact_person && (
                          <div className="text-sm text-muted-foreground">
                            Contact: {supplier.contact_person}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {supplier.supplier_type || 'Not specified'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {supplier.email && (
                          <div className="text-sm">{supplier.email}</div>
                        )}
                        {supplier.phone && (
                          <div className="text-sm text-muted-foreground">{supplier.phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {[supplier.city, supplier.state, supplier.country]
                          .filter(Boolean)
                          .join(', ') || 'Not specified'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {supplier.preferred_currency || 'INR'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {supplier.payment_terms || 'Not specified'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.is_active ? "default" : "secondary"}>
                        {supplier.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(supplier)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(supplier)}
                          disabled={!canEdit}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(supplier.id)}
                          disabled={!canEdit}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredSuppliers.length)} of {filteredSuppliers.length} results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-8"
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
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Summary */}
        {filteredSuppliers.length > 0 && (
          <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
            <div>
              Total: {suppliers.length} suppliers | Filtered: {filteredSuppliers.length}
            </div>
            <div>
              Active: {suppliers.filter(s => s.is_active).length} | 
              Inactive: {suppliers.filter(s => !s.is_active).length}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};