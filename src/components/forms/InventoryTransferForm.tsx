import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

const formSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  from_warehouse_id: z.string().min(1, 'From Warehouse/Bin is required'),
  to_warehouse_id: z.string().min(1, 'To Warehouse/Bin is required'),
  quantity: z.number().min(1, 'Quantity must be greater than 0'),
  reason: z.enum(['rebalancing', 'stock_movement', 'customer_return', 'other'], {
    required_error: 'Reason is required',
  }),
  remarks: z.string().min(1, 'Remarks are required'),
});

type FormData = z.infer<typeof formSchema>;

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  cost_price: number;
}

interface WarehouseBin {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
  bin_name: string;
  wh_bin_code: string;
}

interface InventoryTransferFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const InventoryTransferForm: React.FC<InventoryTransferFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { user, company } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseBins, setWarehouseBins] = useState<WarehouseBin[]>([]);
  const [sourceStock, setSourceStock] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      remarks: '',
    },
  });

  const selectedProductId = form.watch('product_id');
  const selectedFromWarehouseId = form.watch('from_warehouse_id');
  const selectedToWarehouseId = form.watch('to_warehouse_id');
  const quantity = form.watch('quantity');

  useEffect(() => {
    if (company) {
      fetchProducts();
      fetchWarehouseBins();
    }
  }, [company]);

  useEffect(() => {
    if (selectedProductId && selectedFromWarehouseId) {
      fetchSourceStock(selectedProductId, selectedFromWarehouseId);
    }
  }, [selectedProductId, selectedFromWarehouseId]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity, cost_price')
        .eq('company_id', company?.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive',
      });
    }
  };

  const fetchWarehouseBins = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_bins')
        .select('id, warehouse_code, warehouse_name, bin_name, wh_bin_code')
        .eq('company_id', company?.id)
        .eq('is_active', true)
        .order('warehouse_name, bin_name');

      if (error) throw error;
      setWarehouseBins(data || []);
    } catch (error) {
      console.error('Error fetching warehouse bins:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch warehouse bins',
        variant: 'destructive',
      });
    }
  };

  const fetchSourceStock = async (productId: string, warehouseId: string) => {
    if (!productId || !warehouseId || !company) return;

    try {
      const { data, error } = await supabase
        .from('current_stock_levels')
        .select('current_stock')
        .eq('company_id', company.id)
        .eq('product_id', productId)
        .eq('warehouse_id', warehouseId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching source stock:', error);
        setSourceStock(0);
        return;
      }

      setSourceStock(data?.current_stock || 0);
    } catch (error) {
      console.error('Error fetching source stock:', error);
      setSourceStock(0);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user || !company) return;

    // Validate same warehouse/bin selection
    if (data.from_warehouse_id === data.to_warehouse_id) {
      toast({
        title: 'Invalid Transfer',
        description: 'Source and destination warehouse/bin cannot be the same',
        variant: 'destructive',
      });
      return;
    }

    // Validate source stock
    if (sourceStock === 0) {
      toast({
        title: 'No Stock Available',
        description: 'No stock available in the source warehouse/bin',
        variant: 'destructive',
      });
      return;
    }

    if (data.quantity > sourceStock) {
      toast({
        title: 'Insufficient Stock',
        description: `Cannot transfer ${data.quantity} units. Only ${sourceStock} available in source warehouse/bin`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Create stock transfer record
      const { data: transferData, error } = await supabase
        .from('stock_transfers')
        .insert({
          company_id: company.id,
          product_id: data.product_id,
          from_warehouse_id: data.from_warehouse_id,
          from_bin_id: data.from_warehouse_id, // Using warehouse_id as bin_id for now
          to_warehouse_id: data.to_warehouse_id,
          to_bin_id: data.to_warehouse_id, // Using warehouse_id as bin_id for now
          quantity: data.quantity,
          reason: data.reason,
          remarks: data.remarks,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const selectedProduct = products.find(p => p.id === data.product_id);
      const transferNumber = `TRF-${transferData.id.substring(0, 8)}`;

      // Record transfer_out transaction
      const { error: transferOutError } = await supabase.rpc('record_inventory_transaction', {
        p_company_id: company.id,
        p_transaction_type: 'transfer_out',
        p_reference_id: transferData.id,
        p_reference_number: transferNumber,
        p_product_id: data.product_id,
        p_warehouse_id: data.from_warehouse_id,
        p_bin_id: data.from_warehouse_id,
        p_quantity_change: -data.quantity,
        p_unit_cost: selectedProduct?.cost_price || 0,
        p_notes: `Transfer Out - ${data.reason}: ${data.remarks}`,
        p_created_by: user.id
      });

      if (transferOutError) {
        console.error('Error recording transfer out transaction:', transferOutError);
      }

      // Record transfer_in transaction
      const { error: transferInError } = await supabase.rpc('record_inventory_transaction', {
        p_company_id: company.id,
        p_transaction_type: 'transfer_in',
        p_reference_id: transferData.id,
        p_reference_number: transferNumber,
        p_product_id: data.product_id,
        p_warehouse_id: data.to_warehouse_id,
        p_bin_id: data.to_warehouse_id,
        p_quantity_change: data.quantity,
        p_unit_cost: selectedProduct?.cost_price || 0,
        p_notes: `Transfer In - ${data.reason}: ${data.remarks}`,
        p_created_by: user.id
      });

      if (transferInError) {
        console.error('Error recording transfer in transaction:', transferInError);
      }

      toast({
        title: 'Success',
        description: 'Inventory transfer created successfully',
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating inventory transfer:', error);
      toast({
        title: 'Error',
        description: 'Failed to create inventory transfer',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const reasonOptions = [
    { value: 'rebalancing', label: 'Rebalancing' },
    { value: 'stock_movement', label: 'Stock Movement' },
    { value: 'customer_return', label: 'Customer Return' },
    { value: 'other', label: 'Other' },
  ];

  // Filter out selected from warehouse from to warehouse options
  const availableToWarehouses = warehouseBins.filter(
    bin => bin.id !== selectedFromWarehouseId
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="product_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="from_warehouse_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From Warehouse & Bin *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source warehouse & bin" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {warehouseBins.map((bin) => (
                      <SelectItem key={bin.id} value={bin.id}>
                        {bin.warehouse_name} ({bin.warehouse_code}) - {bin.bin_name} ({bin.wh_bin_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="to_warehouse_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To Warehouse & Bin *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination warehouse & bin" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableToWarehouses.map((bin) => (
                      <SelectItem key={bin.id} value={bin.id}>
                        {bin.warehouse_name} ({bin.warehouse_code}) - {bin.bin_name} ({bin.wh_bin_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                {selectedProductId && selectedFromWarehouseId && (
                  <p className="text-sm text-muted-foreground">
                    Available stock: {sourceStock}
                  </p>
                )}
                {quantity > sourceStock && sourceStock > 0 && (
                  <p className="text-sm text-destructive">
                    Quantity exceeds available stock ({sourceStock})
                  </p>
                )}
                {sourceStock === 0 && selectedFromWarehouseId && (
                  <p className="text-sm text-destructive">
                    No stock available in source warehouse/bin
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {reasonOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="remarks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remarks *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter remarks for this transfer..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating Transfer...' : 'Create Transfer'}
          </Button>
        </div>
      </form>
    </Form>
  );
};