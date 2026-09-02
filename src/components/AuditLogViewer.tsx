import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Filter, Download, Clock, User, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  user_id: string;
  company_id: string;
  old_values: any;
  new_values: any;
  created_at: string;
  user_name?: string;
}

interface AuditLogViewerProps {
  className?: string;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ className }) => {
  const { company, profile } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    table_name: '',
    action: '',
    user_id: '',
    date_from: '',
    date_to: ''
  });

  const actionColors = {
    INSERT: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800', 
    DELETE: 'bg-red-100 text-red-800'
  };

  const tableDisplayNames = {
    customers: 'Customers',
    suppliers: 'Suppliers',
    products: 'Products',
    sales_orders: 'Sales Orders',
    purchase_orders: 'Purchase Orders',
    purchase_invoices: 'Purchase Invoices',
    performa_invoices: 'Performa Invoices',
    payments: 'Payments'
  };

  useEffect(() => {
    if (company?.id && (profile?.role === 'owner' || profile?.role === 'admin')) {
      fetchAuditLogs();
    }
  }, [company?.id, profile?.role]);

  const fetchAuditLogs = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('transaction_audit_log')
        .select(`
          *,
          profiles!inner(first_name, last_name)
        `)
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply filters
      if (filters.table_name) {
        query = query.eq('table_name', filters.table_name);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) throw error;

      const processedLogs = (data || []).map((log: any) => ({
        ...log,
        user_name: log.profiles ? `${log.profiles.first_name || ''} ${log.profiles.last_name || ''}`.trim() : 'Unknown User'
      }));

      setLogs(processedLogs);
    } catch (error: any) {
      toast({
        title: "Error loading audit logs",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      table_name: '',
      action: '',
      user_id: '',
      date_from: '',
      date_to: ''
    });
  };

  const exportLogs = () => {
    const csvContent = [
      ['Date/Time', 'User', 'Action', 'Table', 'Record ID', 'Details'].join(','),
      ...logs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.user_name || 'Unknown',
        log.action,
        tableDisplayNames[log.table_name as keyof typeof tableDisplayNames] || log.table_name,
        log.record_id,
        `"${JSON.stringify(log.new_values || log.old_values).replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (profile?.role !== 'owner' && profile?.role !== 'admin') {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            You don't have permission to view audit logs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>Transaction Audit Log</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportLogs}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 p-4 border rounded-lg">
            <div className="space-y-2">
              <Label>Table</Label>
              <Select 
                value={filters.table_name} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, table_name: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All tables</SelectItem>
                  {Object.entries(tableDisplayNames).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select 
                value={filters.action} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  <SelectItem value="INSERT">Created</SelectItem>
                  <SelectItem value="UPDATE">Updated</SelectItem>
                  <SelectItem value="DELETE">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              />
            </div>

            <div className="space-y-2 flex flex-col justify-end">
              <Button onClick={fetchAuditLogs} className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear
              </Button>
            </div>
          </div>

          {/* Audit Log Table */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No audit logs found</h3>
              <p className="text-muted-foreground">
                Transaction logs will appear here as users perform actions
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="text-sm">{log.user_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={actionColors[log.action as keyof typeof actionColors] || 'bg-gray-100 text-gray-800'}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tableDisplayNames[log.table_name as keyof typeof tableDisplayNames] || log.table_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.record_id.split('-')[0]}...
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-xs text-muted-foreground">
                        {log.action === 'DELETE' 
                          ? `Deleted record` 
                          : log.new_values 
                            ? Object.keys(log.new_values).join(', ')
                            : 'No changes recorded'
                        }
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {logs.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              Showing {logs.length} most recent audit entries
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};