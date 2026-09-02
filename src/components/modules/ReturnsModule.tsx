import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PermissionWrapper, PermissionButton, PermissionInput } from '@/components/ui/permission-wrapper';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EnhancedCreateRSOForm } from '@/components/forms/EnhancedCreateRSOForm';
import { 
  RotateCcw, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Eye, 
  Download,
  ArrowLeft,
  Save,
  Check,
  Trash2,
  ChevronsUpDown,
  X,
  AlertCircle,
  MapPin,
  Calendar,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface ReturnOrder {
  id: string;
  rso_number: string;
  rso_date: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  status: 'Draft' | 'Confirmed';
  reason_for_credit: string;
  total_amount: number;
}

interface Customer {
  id: string;
  name: string;
  customer_ref: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin_code?: string;
}

interface SalesInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  total_amount: number;
}

interface InvoiceLineItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  hsn_sac_code?: string;
  unit_of_measure: string;
  quantity_invoiced: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  line_subtotal: number;
  tax_amount: number;
  line_total: number;
  return_qty: number;
  pending_return_qty: number;
  already_returned?: number;
  available_to_return?: number;
}

interface ReturnStats {
  draft_count: number;
  draft_amount: number;
  confirmed_count: number;
  confirmed_amount: number;
}

interface CreditNote {
  id: string;
  cn_number: string;
  cn_date: string;
  customer_name: string;
  rso_number: string;
  status: 'Draft' | 'Confirmed';
  total_amount: number;
}

interface CreditNoteStats {
  draft_count: number;
  draft_amount: number;
  confirmed_count: number;
  confirmed_amount: number;
}

interface CreditNoteItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  hsn_sac_code?: string;
  unit_of_measure: string;
  rso_qty: number;
  return_qty: number;
  pending_return_qty: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  warehouse_id: string;
  bin_id?: string;
  line_subtotal: number;
  tax_amount: number;
  line_total: number;
}

interface Warehouse {
  id: string;
  name: string;
  location?: string;
}

interface SearchableComboboxProps {
  value?: string;
  onSelect: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  options: { id: string; name: string; subtitle?: string }[];
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

function SearchableCombobox({
  value,
  onSelect,
  placeholder,
  searchPlaceholder,
  options,
  disabled = false,
  loading = false,
  emptyMessage = "No options available",
  className = ""
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredOptions = useMemo(() => {
    if (!searchValue) return options;
    return options.filter(option =>
      option.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.subtitle?.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [options, searchValue]);

  const selectedOption = options.find(option => option.id === value);

  const getDisplayText = () => {
    if (selectedOption) return selectedOption.name;
    if (loading) return "Loading...";
    return placeholder;
  };

  const isButtonDisabled = disabled || loading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between ${className}`}
          disabled={isButtonDisabled}
        >
          {getDisplayText()}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="z-[9999] w-[var(--radix-popover-trigger-width)] min-w-[20rem] p-0 bg-white shadow-lg border rounded-md"
        align="start"
        sideOffset={4}
      >
        <Command className="bg-white">
          <CommandInput 
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading options...
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : filteredOptions.length === 0 ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      console.debug('Selected option:', option);
                      onSelect(option.id);
                      setOpen(false);
                      setSearchValue("");
                    }}
                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex flex-col">
                      <span>{option.name}</span>
                      {option.subtitle && (
                        <span className="text-sm text-muted-foreground">{option.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ReturnsModule() {
  const { toast } = useToast();
  const { user, company } = useAuth(); // Get both user and company from auth
  const [activeTab, setActiveTab] = useState('returns');
  
  // Form states
  const [isCreateReturnFormOpen, setIsCreateReturnFormOpen] = useState(false);
  const [isCreateCreditNoteFormOpen, setIsCreateCreditNoteFormOpen] = useState(false);
  const [isCreateRSOFormOpen, setIsCreateRSOFormOpen] = useState(false);
  const [editingRsoId, setEditingRsoId] = useState<string | null>(null);

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [returnOrders, setReturnOrders] = useState<ReturnOrder[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [returnStats, setReturnStats] = useState<ReturnStats | null>(null);
  const [creditNoteStats, setCreditNoteStats] = useState<CreditNoteStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Credit Note form state
  const [selectedRso, setSelectedRso] = useState<ReturnOrder | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [creditNoteItems, setCreditNoteItems] = useState<CreditNoteItem[]>([]);
  const [creditNoteStatus, setCreditNoteStatus] = useState<'Draft' | 'Confirmed'>('Draft');
  const [creditNoteNotes, setCreditNoteNotes] = useState('');

  // Load initial data
  useEffect(() => {
    console.log('ReturnsModule useEffect triggered with company:', company?.id);
    if (company?.id) {
      loadReturnOrders();
      loadCreditNotes();
      loadWarehouses();
      loadReturnStats();
      loadCreditNoteStats();
    }
  }, [company?.id]);

  const loadReturnOrders = async () => {
    console.log('loadReturnOrders called with company:', company?.id);
    if (!company?.id) {
      console.log('No company ID available, skipping RSO load');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Fetching RSO data from Supabase...');
      
      const { data, error } = await supabase
        .from('return_order_header')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      
      console.log('RSO query result:', { data, error, dataLength: data?.length });
      
      if (error) {
        console.error('Error loading RSOs:', error);
        toast({ title: "Error", description: "Failed to load return orders", variant: "destructive" });
        return;
      }
      
      const returnOrdersData: ReturnOrder[] = (data || []).map(order => ({
        id: order.id,
        rso_number: order.rso_number || 'Pending',
        rso_date: order.rso_date,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        invoice_number: order.invoice_number,
        status: order.status as 'Draft' | 'Confirmed',
        reason_for_credit: order.reason_for_credit,
        total_amount: order.total_amount
      }));
      
      console.log('Mapped RSO data:', returnOrdersData);
      setReturnOrders(returnOrdersData);
      console.log('RSO state updated with', returnOrdersData.length, 'items');
      
    } catch (err) {
      console.error('Exception in loadReturnOrders:', err);
      toast({ title: "Error", description: "Failed to load return orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    if (!company?.id) return;
    
    const { data, error } = await supabase
      .from('warehouse_bins')
      .select('id, bin_name, warehouse_name, warehouse_code, wh_bin_code')
      .eq('company_id', company.id)
      .order('warehouse_name, bin_name');
    
    if (error) {
      toast({ title: "Error", description: "Failed to load warehouses", variant: "destructive" });
      return;
    }
    
    const warehouseData: Warehouse[] = (data || []).map(item => ({
      id: item.id,
      name: `${item.warehouse_name || 'Unknown'} - ${item.warehouse_code || 'N/A'}`, // For default location dropdown
      location: `${item.wh_bin_code || 'N/A'} - ${item.bin_name || 'Unknown'}` // For line items dropdown
    }));
    setWarehouses(warehouseData);
  };

  const loadCreditNotes = async () => {
    if (!company?.id) return;
    
    const { data, error } = await supabase
      .from('credit_notes')
      .select(`
        *,
        return_order_header!rso_id (
          rso_number
        )
      `)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: "Error", description: "Failed to load credit notes", variant: "destructive" });
      return;
    }
    
    const creditNotesData: CreditNote[] = (data || []).map(cn => ({
      id: cn.id,
      cn_number: cn.cn_number || 'Pending',
      cn_date: cn.cn_date,
      customer_name: cn.customer_name,
      rso_number: cn.return_order_header?.rso_number || 'Unknown',
      status: cn.status as 'Draft' | 'Confirmed',
      total_amount: cn.total_amount
    }));
    
    setCreditNotes(creditNotesData);
  };

  const loadReturnStats = async () => {
    if (!company?.id) return;
    
    // Simple count and sum from return_order_header
    const { data, error } = await supabase
      .from('return_order_header')
      .select('status, total_amount')
      .eq('company_id', company.id);
    
    if (error) {
      console.error('Error loading return stats:', error);
      return;
    }
    
    const stats = {
      draft_count: data?.filter(r => r.status === 'Draft').length || 0,
      draft_amount: data?.filter(r => r.status === 'Draft').reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0,
      confirmed_count: data?.filter(r => r.status === 'Confirmed').length || 0,
      confirmed_amount: data?.filter(r => r.status === 'Confirmed').reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0
    };
    
    setReturnStats(stats);
  };

  const loadCreditNoteStats = async () => {
    if (!company?.id) return;
    
    const { data, error } = await supabase
      .from('credit_notes')
      .select('status, total_amount')
      .eq('company_id', company.id);
    
    if (error) {
      console.error('Error loading credit note stats:', error);
      return;
    }
    
    const stats = {
      draft_count: data?.filter(cn => cn.status === 'Draft').length || 0,
      draft_amount: data?.filter(cn => cn.status === 'Draft').reduce((sum, cn) => sum + (cn.total_amount || 0), 0) || 0,
      confirmed_count: data?.filter(cn => cn.status === 'Confirmed').length || 0,
      confirmed_amount: data?.filter(cn => cn.status === 'Confirmed').reduce((sum, cn) => sum + (cn.total_amount || 0), 0) || 0
    };
    
    setCreditNoteStats(stats);
  };

  const loadRsoItems = async (rsoId: string) => {
    const { data, error } = await supabase
      .from('return_order_lines')
      .select('*')
      .eq('return_order_id', rsoId);
    
    if (error) {
      toast({ title: "Error", description: "Failed to load RSO items", variant: "destructive" });
      return;
    }

    const items: CreditNoteItem[] = (data || []).map(item => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      hsn_sac_code: item.hsn_sac_code,
      unit_of_measure: item.unit_of_measure,
      rso_qty: item.return_qty,
      return_qty: 0,
      pending_return_qty: item.return_qty,
      unit_price: item.unit_price,
      discount_percentage: item.discount_percentage || 0,
      discount_amount: item.discount_amount,
      cgst_rate: item.cgst_rate || 0,
      cgst_amount: item.cgst_amount || 0,
      sgst_rate: item.sgst_rate || 0,
      sgst_amount: item.sgst_amount || 0,
      igst_rate: item.igst_rate || 0,
      igst_amount: item.igst_amount || 0,
      warehouse_id: selectedWarehouse?.id || '',  // Apply default warehouse
      bin_id: selectedWarehouse?.id || '',        // Use same ID for now
      line_subtotal: item.line_subtotal,
      tax_amount: item.tax_amount,
      line_total: item.line_total
    }));
    
    setCreditNoteItems(items);
  };

  // Auto-apply default warehouse to items when warehouse is selected or items are loaded
  useEffect(() => {
    if (selectedWarehouse && creditNoteItems.length > 0) {
      setCreditNoteItems(items => 
        items.map(item => ({
          ...item,
          warehouse_id: item.warehouse_id || selectedWarehouse.id,
          bin_id: item.bin_id || selectedWarehouse.id
        }))
      );
    }
  }, [selectedWarehouse]);

  const handleRsoSelect = (rsoId: string) => {
    const rso = returnOrders.find(r => r.id === rsoId);
    if (rso) {
      setSelectedRso(rso);
      loadRsoItems(rsoId);
    }
  };

  const handleWarehouseSelect = (warehouseId: string) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    if (warehouse) {
      setSelectedWarehouse(warehouse);
      // Update all items with the selected warehouse
      setCreditNoteItems(items => 
        items.map(item => ({ ...item, warehouse_id: warehouseId }))
      );
    }
  };

  const handleReturnQtyChange = (itemId: string, returnQty: number) => {
    setCreditNoteItems(items =>
      items.map(item => {
        if (item.id === itemId) {
          const validReturnQty = Math.min(Math.max(0, returnQty), item.rso_qty);
          const pendingReturnQty = item.rso_qty - validReturnQty;
          
          // Recalculate amounts based on new return qty
          const lineSubtotal = validReturnQty * item.unit_price;
          const discountAmount = (lineSubtotal * item.discount_percentage) / 100;
          const taxableAmount = lineSubtotal - discountAmount;
          const cgstAmount = (taxableAmount * item.cgst_rate) / 100;
          const sgstAmount = (taxableAmount * item.sgst_rate) / 100;
          const igstAmount = (taxableAmount * item.igst_rate) / 100;
          const taxAmount = cgstAmount + sgstAmount + igstAmount;
          const lineTotal = taxableAmount + taxAmount;

          return {
            ...item,
            return_qty: validReturnQty,
            pending_return_qty: pendingReturnQty,
            line_subtotal: lineSubtotal,
            discount_amount: discountAmount,
            cgst_amount: cgstAmount,
            sgst_amount: sgstAmount,
            igst_amount: igstAmount,
            tax_amount: taxAmount,
            line_total: lineTotal
          };
        }
        return item;
      })
    );
  };

  // Handler for per-line warehouse/bin selection
  const handleItemWarehouseChange = (itemId: string, warehouseId: string) => {
    setCreditNoteItems(items =>
      items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            warehouse_id: warehouseId,
            bin_id: warehouseId // Using same ID for warehouse and bin for now
          };
        }
        return item;
      })
    );
  };

  const calculateTotals = () => {
    const subtotal = creditNoteItems.reduce((sum, item) => sum + item.line_subtotal, 0);
    const discount = creditNoteItems.reduce((sum, item) => sum + item.discount_amount, 0);
    const tax = creditNoteItems.reduce((sum, item) => sum + item.tax_amount, 0);
    const total = creditNoteItems.reduce((sum, item) => sum + item.line_total, 0);
    
    return { subtotal, discount, tax, total };
  };

  const validateCreditNote = () => {
    const errors: string[] = [];
    
    if (!selectedRso) errors.push("Please select an RSO");
    if (creditNoteItems.length === 0) errors.push("No items found for credit note");
    
    // Check if at least one item has return quantity > 0
    const hasReturnItems = creditNoteItems.some(item => item.return_qty > 0);
    if (!hasReturnItems) errors.push("At least one item must have return quantity > 0");
    
    // Check warehouse is selected for items with return_qty > 0
    const itemsWithReturn = creditNoteItems.filter(item => item.return_qty > 0);
    const missingWarehouse = itemsWithReturn.some(item => !item.warehouse_id);
    if (missingWarehouse) errors.push("All items with return quantity must have warehouse selected");
    
    return errors;
  };

  const handleSaveCreditNote = async () => {
    const errors = validateCreditNote();
    if (errors.length > 0) {
      toast({ title: "Validation Error", description: errors.join(", "), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const totals = calculateTotals();
      
      // Insert credit note header
      const { data: creditNote, error: cnError } = await supabase
        .from('credit_notes')
        .insert([{
          company_id: company!.id,
          rso_id: selectedRso!.id,
          status: creditNoteStatus,
          default_warehouse_id: selectedWarehouse?.id || creditNoteItems.find(item => item.return_qty > 0)?.warehouse_id || '',
          customer_id: selectedRso!.customer_id, // Use correct customer_id from RSO
          customer_name: selectedRso!.customer_name,
          cn_date: creditNoteDate,
          subtotal_amount: totals.subtotal,
          discount_amount: totals.discount,
          tax_amount: totals.tax,
          total_amount: totals.total,
          notes: creditNoteNotes,
          created_by: user!.id // Use user ID, not company ID
        }])
        .select()
        .single();

      if (cnError) throw cnError;

      // Insert credit note items
      const itemsToInsert = creditNoteItems
        .filter(item => item.return_qty > 0)
        .map(item => ({
          credit_note_id: creditNote.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          hsn_sac_code: item.hsn_sac_code,
          unit_of_measure: item.unit_of_measure,
          rso_qty: item.rso_qty,
          return_qty: item.return_qty,
          pending_return_qty: item.pending_return_qty,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          discount_amount: item.discount_amount,
          cgst_rate: item.cgst_rate,
          cgst_amount: item.cgst_amount,
          sgst_rate: item.sgst_rate,
          sgst_amount: item.sgst_amount,
          igst_rate: item.igst_rate,
          igst_amount: item.igst_amount,
          warehouse_id: item.warehouse_id,
          bin_id: item.bin_id,
          line_subtotal: item.line_subtotal,
          tax_amount: item.tax_amount,
          line_total: item.line_total
        }));

      const { error: itemsError } = await supabase
        .from('credit_note_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Process inventory for confirmed credit notes
      if (creditNoteStatus === 'Confirmed') {
        try {
          await processCreditNoteInventory(creditNote.id, creditNote.cn_number, itemsToInsert);
          console.log('✅ Credit note inventory processing completed successfully');
        } catch (inventoryError) {
          console.error('❌ Inventory processing failed:', inventoryError);
          // If inventory processing fails, we should not save the credit note as confirmed
          throw new Error(`Failed to process inventory: ${inventoryError instanceof Error ? inventoryError.message : 'Unknown error'}`);
        }
      }

      toast({ 
        title: "Success", 
        description: `Credit Note ${creditNoteStatus === 'Confirmed' ? 'created and confirmed' : 'saved as draft'}`, 
        variant: "default" 
      });

      // Reset form and reload data
      resetCreditNoteForm();
      loadCreditNotes();
      loadCreditNoteStats();
      
      // Refresh inventory data if we're on that tab or need to update stock views
      if (typeof window !== 'undefined') {
        // Trigger a custom event that inventory components can listen to
        window.dispatchEvent(new CustomEvent('inventoryUpdated', { 
          detail: { type: 'credit_note_confirmed', creditNoteId: creditNote.id } 
        }));
      }
      
      // Refresh inventory transactions if the component is available
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('refreshInventoryTransactions'));
      }

    } catch (error) {
      console.error('❌ Error saving credit note:', error);
      let errorMessage = "Failed to save credit note";
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to process inventory')) {
          errorMessage = "Credit note not saved: " + error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const resetCreditNoteForm = () => {
    setSelectedRso(null);
    setSelectedWarehouse(null);
    setCreditNoteDate(new Date().toISOString().split('T')[0]);
    setCreditNoteItems([]);
    setCreditNoteStatus('Draft');
    setCreditNoteNotes('');
    setIsCreateCreditNoteFormOpen(false);
  };

  // Process inventory for confirmed credit notes
  const processCreditNoteInventory = async (creditNoteId: string, creditNoteNumber: string, creditNoteItems: any[]) => {
    try {
      console.log('Processing inventory for confirmed credit note:', creditNoteId);
      
      for (const item of creditNoteItems) {
        if (item.return_qty <= 0) continue;

        // First record the inventory transaction
        const { error: transactionError } = await supabase.rpc('record_inventory_transaction', {
          p_company_id: company!.id,
          p_transaction_type: 'sales_return',
          p_reference_id: creditNoteId,
          p_reference_number: creditNoteNumber, // Use actual credit note number
          p_product_id: item.product_id,
          p_warehouse_id: item.warehouse_id,
          p_bin_id: item.bin_id || item.warehouse_id,
          p_quantity_change: item.return_qty, // Positive quantity for returns
          p_unit_cost: item.unit_price,
          p_notes: `Credit Note Return - ${item.product_name} (${item.return_qty} units)`,
          p_created_by: user!.id
        });

        if (transactionError) {
          console.error('Error recording inventory transaction:', transactionError);
          throw new Error(`Failed to record inventory transaction for ${item.product_name}: ${transactionError.message}`);
        }

        console.log(`✅ Recorded inventory transaction for ${item.product_name}: +${item.return_qty} units`);

        // Now calculate the correct stock from inventory transactions and sync products table
        await reconcileProductStock(item.product_id, item.warehouse_id, item.bin_id);
      }

      console.log('✅ Inventory processing completed successfully for credit note:', creditNoteId);
    } catch (error) {
      console.error('❌ Error processing credit note inventory:', error);
      toast({ 
        title: "Inventory Update Failed", 
        description: error instanceof Error ? error.message : "Failed to update inventory for credit note", 
        variant: "destructive" 
      });
      throw error; // Re-throw to prevent credit note from being saved if inventory fails
    }
  };

  // Reconcile product stock quantity with actual inventory transactions
  const reconcileProductStock = async (productId: string, warehouseId: string, binId: string) => {
    try {
      // Calculate actual stock from inventory transactions
      const { data: transactions, error: transError } = await supabase
        .from('inventory_transactions')
        .select('quantity_change')
        .eq('company_id', company!.id)
        .eq('product_id', productId)
        .eq('warehouse_id', warehouseId)
        .eq('bin_id', binId);

      if (transError) {
        throw new Error(`Failed to fetch inventory transactions: ${transError.message}`);
      }

      // Calculate total stock from all transactions
      const actualStock = transactions?.reduce((sum, t) => sum + (t.quantity_change || 0), 0) || 0;
      
      console.log(`📊 Calculated actual stock for product ${productId}: ${actualStock} units`);

      // Get current product stock to compare
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock_quantity, name, sku')
        .eq('id', productId)
        .single();

      if (productError) {
        throw new Error(`Failed to fetch product: ${productError.message}`);
      }

      const currentStock = product.stock_quantity || 0;
      console.log(`📊 Current product stock for ${product.name} (${product.sku}): ${currentStock} units`);
      
      // Update product stock to match inventory transactions if different
      if (currentStock !== actualStock) {
        console.log(`🔄 Reconciling stock: ${currentStock} → ${actualStock} (difference: ${actualStock - currentStock})`);
        
        const { error: updateError } = await supabase
          .from('products')
          .update({
            stock_quantity: actualStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', productId);

        if (updateError) {
          throw new Error(`Failed to update product stock: ${updateError.message}`);
        }

        console.log(`✅ Successfully reconciled stock for ${product.name}: ${actualStock} units`);
        return { reconciled: true, difference: actualStock - currentStock };
      } else {
        console.log(`✅ Stock already in sync for ${product.name}: ${actualStock} units`);
        return { reconciled: false, difference: 0 };
      }

    } catch (error) {
      console.error('❌ Error reconciling product stock:', error);
      throw error;
    }
  };

  // Reconcile all products in the company to sync with inventory transactions
  const reconcileAllProductStock = async () => {
    if (!company?.id) return;
    
    setLoading(true);
    try {
      console.log('🔄 Starting company-wide stock reconciliation...');
      
      // Get all products with inventory transactions
      const { data: stockLevels, error } = await supabase
        .from('current_stock_levels')
        .select('product_id, warehouse_id, bin_id, current_stock')
        .eq('company_id', company.id);

      if (error) throw error;

      let reconciledCount = 0;
      let totalDifference = 0;

      for (const stock of stockLevels || []) {
        try {
          const result = await reconcileProductStock(stock.product_id, stock.warehouse_id, stock.bin_id);
          if (result.reconciled) {
            reconciledCount++;
            totalDifference += Math.abs(result.difference);
          }
        } catch (error) {
          console.error(`Failed to reconcile product ${stock.product_id}:`, error);
        }
      }

      toast({
        title: "Stock Reconciliation Complete",
        description: `Reconciled ${reconciledCount} products with ${totalDifference} total units adjusted`,
      });

      console.log(`✅ Stock reconciliation complete: ${reconciledCount} products reconciled`);
      
      // Refresh the data
      loadReturnOrders();
      loadCreditNotes();
      
    } catch (error) {
      console.error('❌ Error during stock reconciliation:', error);
      toast({
        title: "Reconciliation Failed",
        description: error instanceof Error ? error.message : "Failed to reconcile stock",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // RSO Action Handlers
  const handleViewRso = (rsoId: string) => {
    // TODO: Implement RSO view dialog
    toast({ 
      title: "View RSO", 
      description: "RSO view functionality will be implemented", 
      variant: "default" 
    });
  };

  const handleEditRso = (rsoId: string) => {
    setEditingRsoId(rsoId);
    setIsCreateRSOFormOpen(true);
  };

  const handleDeleteRso = async (rsoId: string) => {
    if (!window.confirm('Are you sure you want to delete this RSO?')) {
      return;
    }

    try {
      setLoading(true);

      // Delete RSO lines first
      const { error: linesError } = await supabase
        .from('return_order_lines')
        .delete()
        .eq('return_order_id', rsoId);

      if (linesError) throw linesError;

      // Delete RSO header
      const { error: headerError } = await supabase
        .from('return_order_header')
        .delete()
        .eq('id', rsoId)
        .eq('company_id', company!.id);

      if (headerError) throw headerError;

      toast({
        title: 'Success',
        description: 'RSO deleted successfully',
      });

      // Reload data
      loadReturnOrders();
      loadReturnStats();
    } catch (error) {
      console.error('Error deleting RSO:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete RSO',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: 'Draft' | 'Confirmed') => {
    return (
      <Badge variant={status === 'Confirmed' ? 'default' : 'secondary'}>
        {status}
      </Badge>
    );
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={reconcileAllProductStock}
          disabled={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Reconciling...' : 'Reconcile Stock'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="returns">Return Sales Orders</TabsTrigger>
          <TabsTrigger value="credit-notes">Credit Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="returns" className="space-y-6">
          {/* Return Sales Orders Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Draft RSOs</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{returnStats?.draft_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  ₹{(returnStats?.draft_amount || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Confirmed RSOs</CardTitle>
                <Check className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{returnStats?.confirmed_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  ₹{(returnStats?.confirmed_amount || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Create RSO Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Return Sales Orders</h3>
            <div className="flex space-x-2">
              <Button 
                variant="outline"
                onClick={loadReturnOrders}
                disabled={loading}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button 
                onClick={() => setIsCreateRSOFormOpen(true)}
                disabled={loading}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create RSO
              </Button>
            </div>
          </div>

          {/* RSO Form */}
          {isCreateRSOFormOpen && (
            <EnhancedCreateRSOForm
              rsoId={editingRsoId}
              onClose={() => {
                setIsCreateRSOFormOpen(false);
                setEditingRsoId(null);
              }}
              onSave={() => {
                loadReturnOrders();
                loadReturnStats();
                setIsCreateRSOFormOpen(false);
                setEditingRsoId(null);
              }}
            />
          )}

          {/* RSO Table */}
          {!isCreateRSOFormOpen && (
            <Card>
              <CardHeader>
                <CardTitle>RSO List</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : returnOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No return sales orders found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>RSO Number</TableHead>
                          <TableHead>RSO Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total Amount</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnOrders.map((rso) => (
                          <TableRow key={rso.id}>
                            <TableCell className="font-medium">{rso.rso_number}</TableCell>
                            <TableCell>{rso.rso_date}</TableCell>
                            <TableCell>{rso.customer_name}</TableCell>
                            <TableCell>{rso.invoice_number}</TableCell>
                            <TableCell>
                              <Badge variant={rso.status === 'Confirmed' ? 'default' : 'secondary'}>
                                {rso.status}
                              </Badge>
                            </TableCell>
                            <TableCell>₹{rso.total_amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewRso(rso.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {rso.status === 'Draft' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditRso(rso.id)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteRso(rso.id)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="credit-notes" className="space-y-6">
          {/* Credit Notes Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Draft Credit Notes</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{creditNoteStats?.draft_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  ₹{(creditNoteStats?.draft_amount || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Confirmed Credit Notes</CardTitle>
                <Check className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{creditNoteStats?.confirmed_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  ₹{(creditNoteStats?.confirmed_amount || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Create Credit Note Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Credit Notes</h3>
            <div className="flex space-x-2">
              <Button 
                variant="outline"
                onClick={() => {
                  console.log('Refresh button clicked - reloading RSO data');
                  loadReturnOrders();
                  loadCreditNotes();
                }}
                disabled={loading}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button 
                onClick={() => setIsCreateCreditNoteFormOpen(true)}
                disabled={loading}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Credit Note
              </Button>
            </div>
          </div>

          {/* Credit Note Form */}
          {isCreateCreditNoteFormOpen && (
            <Card>
              <CardHeader>
                <CardTitle>Create Credit Note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Header Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="warehouse">Default Location (Warehouse/Bin)</Label>
                    <SearchableCombobox
                      value={selectedWarehouse?.id}
                      onSelect={handleWarehouseSelect}
                      placeholder="Select warehouse"
                      searchPlaceholder="Search warehouses..."
                      options={warehouses.map(w => ({
                        id: w.id,
                        name: w.name, // Shows "Warehouse name - Warehouse code"
                        subtitle: undefined
                      }))}
                      loading={loading}
                      emptyMessage="No warehouses found"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cn-date">CN Date</Label>
                    <Input
                      id="cn-date"
                      type="date"
                      value={creditNoteDate}
                      onChange={(e) => setCreditNoteDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <RadioGroup value={creditNoteStatus} onValueChange={(value) => setCreditNoteStatus(value as 'Draft' | 'Confirmed')}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Draft" id="draft" />
                        <Label htmlFor="draft">Draft</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Confirmed" id="confirmed" />
                        <Label htmlFor="confirmed">Confirmed</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rso">Return Sales Order (RSO) *</Label>
                  <SearchableCombobox
                    value={selectedRso?.id}
                    onSelect={handleRsoSelect}
                    placeholder="Select RSO"
                    searchPlaceholder="Search RSO..."
                    options={returnOrders.map(rso => {
                      console.log('Mapping RSO for combobox:', rso);
                      return {
                        id: rso.id,
                        name: rso.rso_number,
                        subtitle: `${rso.customer_name} - ${rso.invoice_number}`
                      };
                    })}
                    loading={loading}
                    emptyMessage="No confirmed RSOs found"
                  />
                  {/* Debug info */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-500 mt-1">
                      Debug: {returnOrders.length} RSOs loaded, Loading: {loading ? 'Yes' : 'No'}
                    </div>
                  )}
                </div>

                {/* Line Items Table */}
                {creditNoteItems.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold">Line Items</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                         <TableHeader>
                           <TableRow>
                             <TableHead>Item Code</TableHead>
                             <TableHead>Description</TableHead>
                             <TableHead>RSO Qty</TableHead>
                             <TableHead>Return Qty</TableHead>
                             <TableHead>Pending</TableHead>
                             <TableHead>Unit Price</TableHead>
                             <TableHead>Discount %</TableHead>
                             <TableHead>CGST %</TableHead>
                             <TableHead>SGST %</TableHead>
                             <TableHead>IGST %</TableHead>
                             <TableHead>Warehouse/Bin</TableHead>
                             <TableHead>Line Total</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {creditNoteItems.map((item) => {
                             const hasReturnQty = item.return_qty > 0;
                             const missingWarehouse = hasReturnQty && !item.warehouse_id;
                             
                             return (
                               <TableRow key={item.id} className={missingWarehouse ? "bg-red-50 border-red-200" : ""}>
                                 <TableCell>{item.product_sku}</TableCell>
                                 <TableCell>{item.product_name}</TableCell>
                                 <TableCell>{item.rso_qty}</TableCell>
                                 <TableCell>
                                   <Input
                                     type="number"
                                     min="0"
                                     max={item.rso_qty}
                                     value={item.return_qty}
                                     onChange={(e) => handleReturnQtyChange(item.id, parseInt(e.target.value) || 0)}
                                     className="w-20"
                                   />
                                 </TableCell>
                                 <TableCell>{item.pending_return_qty}</TableCell>
                                 <TableCell>₹{item.unit_price.toFixed(2)}</TableCell>
                                 <TableCell>{item.discount_percentage}%</TableCell>
                                 <TableCell>{item.cgst_rate}%</TableCell>
                                 <TableCell>{item.sgst_rate}%</TableCell>
                                 <TableCell>{item.igst_rate}%</TableCell>
                                 <TableCell className="min-w-[200px]">
                                    <SearchableCombobox
                                      value={item.warehouse_id}
                                      onSelect={(warehouseId) => handleItemWarehouseChange(item.id, warehouseId)}
                                      placeholder="Select warehouse/bin"
                                      searchPlaceholder="Search warehouses..."
                                      options={warehouses.map(w => ({
                                        id: w.id,
                                        name: w.location, // Shows "Bin code - Bin name"
                                        subtitle: w.name // Shows "Warehouse name - Warehouse code" as subtitle
                                      }))}
                                      className={`${missingWarehouse ? 'border-red-500' : ''} text-xs`}
                                      disabled={item.return_qty === 0}
                                      emptyMessage="No warehouses found"
                                    />
                                   {missingWarehouse && (
                                     <div className="text-xs text-red-600 mt-1">
                                       <AlertCircle className="h-3 w-3 inline mr-1" />
                                       Required for return items
                                     </div>
                                   )}
                                 </TableCell>
                                 <TableCell>₹{item.line_total.toFixed(2)}</TableCell>
                               </TableRow>
                             );
                           })}
                         </TableBody>
                      </Table>
                    </div>

                    {/* Totals */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Subtotal:</span>
                          <div>₹{totals.subtotal.toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="font-medium">Discount:</span>
                          <div>₹{totals.discount.toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="font-medium">Tax:</span>
                          <div>₹{totals.tax.toFixed(2)}</div>
                        </div>
                        <div>
                          <span className="font-medium text-lg">Total:</span>
                          <div className="text-lg font-bold">₹{totals.total.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={creditNoteNotes}
                    onChange={(e) => setCreditNoteNotes(e.target.value)}
                    placeholder="Enter any additional notes..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={resetCreditNoteForm}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveCreditNote} disabled={loading}>
                    {loading ? 'Saving...' : `Save ${creditNoteStatus}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Credit Notes Table */}
          <Card>
            <CardHeader>
              <CardTitle>Credit Notes List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CN Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>RSO Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNotes.map((cn) => (
                    <TableRow key={cn.id}>
                      <TableCell>{cn.cn_number}</TableCell>
                      <TableCell>{cn.cn_date}</TableCell>
                      <TableCell>{cn.customer_name}</TableCell>
                      <TableCell>{cn.rso_number}</TableCell>
                      <TableCell>{getStatusBadge(cn.status)}</TableCell>
                      <TableCell>₹{cn.total_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {cn.status === 'Draft' && (
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {creditNotes.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No credit notes found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
