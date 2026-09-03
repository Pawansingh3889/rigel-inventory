import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { Plus, Search, Edit, Trash2, Play, CheckCircle, XCircle, AlertTriangle, Package, Factory } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string | null;
  cost_price: number;
  unit_price: number;
  stock_quantity: number;
  product_category: string;
  is_active: boolean;
}

interface WarehouseBin {
  id: string;
  warehouse_name: string;
  warehouse_code: string | null;
  bin_name: string;
  wh_bin_code: string;
  is_active: boolean;
}

interface Warehouse {
  name: string;
  code: string | null;
  bins: WarehouseBin[];
}

interface BOMComponent {
  id: string;
  product_id?: string;
  product_name?: string;
  product_sku?: string;
  unit?: string | null;
  quantity_per_unit: number;
  unit_cost: number;
  line_total: number;
}

interface BOMHeader {
  id: string;
  bom_name: string;
  finished_product_id: string;
  finished_product_name?: string;
  finished_product_sku?: string;
  yield_quantity: number;
  material_cost_per_unit: number;
  labor_cost_per_unit: number;
  overhead_cost_per_unit: number;
  total_cost_per_unit: number;
  warehouse_id: string | null;
  bin_id: string | null;
  warehouse_name?: string;
  bin_name?: string;
  is_active: boolean;
  production_ready: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  components?: BOMComponent[];
}

export function BOMModule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasEditAccess } = useBusinessAuth();
  const canEdit = hasEditAccess('inventory');

  // State for products and warehouse bins
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseBins, setWarehouseBins] = useState<WarehouseBin[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [boms, setBoms] = useState<BOMHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [showBOMDialog, setShowBOMDialog] = useState(false);
  const [editingBOM, setEditingBOM] = useState<BOMHeader | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    bomName: '',
    finishedProductId: '',
    yieldQuantity: 1,
    laborCost: 0,
    overheadCost: 0,
    warehouseId: '',
    binId: '',
    notes: '',
    productionReady: false,
  });

  const [components, setComponents] = useState<BOMComponent[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [productionQuantity, setProductionQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProducing, setIsProducing] = useState(false);

  // Computed values
  const rawMaterialProducts = useMemo(() => 
    products.filter(p => p.product_category !== 'finished_goods' && p.is_active), 
    [products]
  );

  const finishedGoodsProducts = useMemo(() => 
    products.filter(p => p.product_category === 'finished_goods' && p.is_active), 
    [products]
  );

  const filteredBins = useMemo(() =>
    warehouseBins.filter(bin => bin.warehouse_name === selectedWarehouse && bin.is_active),
    [warehouseBins, selectedWarehouse]
  );

  const costSummary = useMemo(() => {
    const materialCost = components.reduce((sum, comp) => sum + comp.line_total, 0);
    const totalCost = materialCost + formData.laborCost + formData.overheadCost;
    return {
      material: materialCost,
      labor: formData.laborCost,
      overhead: formData.overheadCost,
      total: totalCost,
    };
  }, [components, formData.laborCost, formData.overheadCost]);

  const filteredBoms = useMemo(() => 
    boms.filter(bom => 
      bom.bom_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bom.finished_product_name?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [boms, searchTerm]
  );

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      
      const [productsResponse, warehouseBinsResponse, bomsResponse] = await Promise.all([
        supabase.from('products').select('*').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('warehouse_bins').select('*').eq('company_id', profile.company_id).eq('is_active', true),
        supabase.from('bom_headers').select(`
          *,
          products!bom_headers_finished_product_id_fkey(name, sku)
        `).eq('company_id', profile.company_id)
      ]);

      if (productsResponse.data) setProducts(productsResponse.data);
      if (warehouseBinsResponse.data) {
        setWarehouseBins(warehouseBinsResponse.data);
        
        // Group bins by warehouse
        const warehouseGroups = warehouseBinsResponse.data.reduce((acc: Record<string, WarehouseBin[]>, bin) => {
          const key = bin.warehouse_name;
          if (!acc[key]) acc[key] = [];
          acc[key].push(bin);
          return acc;
        }, {});

        const warehouseList = Object.entries(warehouseGroups).map(([name, bins]) => ({
          name,
          code: bins[0].warehouse_code,
          bins
        }));
        
        setWarehouses(warehouseList);
      }
      
      if (bomsResponse.data) {
        const bomsWithProductNames = bomsResponse.data.map(bom => ({
          ...bom,
          finished_product_name: bom.products?.name,
          finished_product_sku: bom.products?.sku,
          production_ready: bom.production_ready ?? false
        }));
        setBoms(bomsWithProductNames);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Component management
  const addComponent = () => {
    const newComponent: BOMComponent = {
      id: `temp-${Date.now()}`,
      quantity_per_unit: 1,
      unit_cost: 0,
      line_total: 0,
    };
    setComponents(prev => [...prev, newComponent]);
  };

  const updateComponent = (id: string, updates: Partial<BOMComponent>) => {
    setComponents(prev => prev.map(comp => {
      if (comp.id === id) {
        const updated = { ...comp, ...updates };
        
        // Update product details if product_id changed
        if (updates.product_id && updates.product_id !== comp.product_id) {
          const product = products.find(p => p.id === updates.product_id);
          if (product) {
            updated.product_name = product.name;
            updated.product_sku = product.sku;
            updated.unit = product.unit;
            updated.unit_cost = product.cost_price;
          }
        }
        
        // Recalculate line total when quantity or cost changes
        if ('quantity_per_unit' in updates || 'unit_cost' in updates) {
          updated.line_total = updated.quantity_per_unit * updated.unit_cost;
        }
        
        return updated;
      }
      return comp;
    }));
  };

  const removeComponent = (id: string) => {
    setComponents(prev => prev.filter(comp => comp.id !== id));
  };

  // Form management
  const resetForm = () => {
    setFormData({
      bomName: '',
      finishedProductId: '',
      yieldQuantity: 1,
      laborCost: 0,
      overheadCost: 0,
      warehouseId: '',
      binId: '',
      notes: '',
      productionReady: false,
    });
    setComponents([]);
    setSelectedWarehouse('');
    setEditingBOM(null);
  };

  const loadBOMForEdit = async (bom: BOMHeader) => {
    try {
      // Fetch BOM components
      const { data: componentsData, error } = await supabase
        .from('bom_components')
        .select(`
          *,
          products!bom_components_component_product_id_fkey(name, sku, unit, cost_price)
        `)
        .eq('bom_id', bom.id);

      if (error) throw error;

      // Load form data
      setFormData({
        bomName: bom.bom_name,
        finishedProductId: bom.finished_product_id,
        yieldQuantity: bom.yield_quantity,
        laborCost: bom.labor_cost_per_unit,
        overheadCost: bom.overhead_cost_per_unit,
        warehouseId: bom.warehouse_id || '',
        binId: bom.bin_id || '',
        notes: bom.notes || '',
        productionReady: bom.production_ready,
      });

      // Find and set warehouse
      if (bom.warehouse_id) {
        const warehouseBin = warehouseBins.find(wb => wb.id === bom.warehouse_id);
        if (warehouseBin) {
          setSelectedWarehouse(warehouseBin.warehouse_name);
        }
      }

      // Load components
      const loadedComponents: BOMComponent[] = componentsData?.map(comp => ({
        id: comp.id,
        product_id: comp.component_product_id,
        product_name: comp.products?.name,
        product_sku: comp.products?.sku,
        unit: comp.products?.unit,
        quantity_per_unit: comp.quantity_per_unit,
        unit_cost: comp.unit_cost,
        line_total: comp.quantity_per_unit * comp.unit_cost,
      })) || [];

      setComponents(loadedComponents);
      setEditingBOM(bom);
      setShowBOMDialog(true);
    } catch (error) {
      console.error('Error loading BOM:', error);
      toast({
        title: "Error",
        description: "Failed to load BOM for editing",
        variant: "destructive",
      });
    }
  };

  // Save BOM
  const saveBOM = async () => {
    if (!profile?.company_id) return;

    if (!formData.bomName.trim()) {
      toast({
        title: "Error",
        description: "BOM name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.finishedProductId) {
      toast({
        title: "Error",
        description: "Please select a finished product",
        variant: "destructive",
      });
      return;
    }

    if (components.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one component",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const bomData = {
        company_id: profile.company_id,
        bom_name: formData.bomName,
        finished_product_id: formData.finishedProductId,
        yield_quantity: formData.yieldQuantity,
        labor_cost_per_unit: formData.laborCost,
        overhead_cost_per_unit: formData.overheadCost,
        material_cost_per_unit: costSummary.material,
        total_cost_per_unit: costSummary.total,
        warehouse_id: formData.warehouseId || null,
        bin_id: formData.binId || null,
        notes: formData.notes || null,
        production_ready: formData.productionReady,
        is_active: true,
      };

      let bomId = editingBOM?.id;

      if (editingBOM) {
        // Update existing BOM
        const { error: updateError } = await supabase
          .from('bom_headers')
          .update(bomData)
          .eq('id', editingBOM.id);

        if (updateError) throw updateError;

        // Delete existing components
        const { error: deleteError } = await supabase
          .from('bom_components')
          .delete()
          .eq('bom_id', editingBOM.id);

        if (deleteError) throw deleteError;
      } else {
        // Create new BOM
        const { data: newBOM, error: insertError } = await supabase
          .from('bom_headers')
          .insert(bomData)
          .select()
          .single();

        if (insertError) throw insertError;
        bomId = newBOM.id;
      }

      // Insert components
      const componentInserts = components
        .filter(comp => comp.product_id && comp.quantity_per_unit > 0)
        .map(comp => ({
          bom_id: bomId!,
          component_product_id: comp.product_id!,
          quantity_per_unit: comp.quantity_per_unit,
          unit_cost: comp.unit_cost,
        }));

      if (componentInserts.length > 0) {
        const { error: componentsError } = await supabase
          .from('bom_components')
          .insert(componentInserts);

        if (componentsError) throw componentsError;
      }

      toast({
        title: "Success",
        description: `BOM ${editingBOM ? 'updated' : 'created'} successfully`,
      });

      setShowBOMDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving BOM:', error);
      toast({
        title: "Error",
        description: "Failed to save BOM",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete BOM
  const deleteBOM = async (bomId: string) => {
    try {
      // Delete components first
      const { error: componentsError } = await supabase
        .from('bom_components')
        .delete()
        .eq('bom_id', bomId);

      if (componentsError) throw componentsError;

      // Delete BOM header
      const { error: headerError } = await supabase
        .from('bom_headers')
        .delete()
        .eq('id', bomId);

      if (headerError) throw headerError;

      toast({
        title: "Success",
        description: "BOM deleted successfully",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting BOM:', error);
      toast({
        title: "Error",
        description: "Failed to delete BOM",
        variant: "destructive",
      });
    }
  };

  // Production
  const runProduction = async (bom: BOMHeader) => {
    if (!profile?.company_id) return;
    
    if (!bom.production_ready) {
      toast({
        title: "Error",
        description: "BOM is not marked as production ready. No inventory actions will be performed.",
        variant: "destructive",
      });
      return;
    }

    if (productionQuantity <= 0) {
      toast({
        title: "Error",
        description: "Production quantity must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProducing(true);

      const { data: result, error } = await supabase.rpc('process_bom_production', {
        p_bom_id: bom.id,
        p_quantity: productionQuantity,
        p_company_id: profile.company_id,
        p_warehouse_id: bom.warehouse_id,
        p_bin_id: bom.bin_id,
      });

      if (error) throw error;

      const productionResult = result as {
        success: boolean;
        finished_goods_qty: number;
        material_cost_total: number;
        labor_cost_total: number;
        overhead_cost_total: number;
        total_cost: number;
      };

      toast({
        title: "Success",
        description: `Production completed! Produced ${productionResult.finished_goods_qty} units`,
      });

      fetchData();
    } catch (error) {
      console.error('Error running production:', error);
      toast({
        title: "Error",
        description: "Failed to run production",
        variant: "destructive",
      });
    } finally {
      setIsProducing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bill of Materials (BOM)</h2>
          <p className="text-muted-foreground">Manage production recipes with proper warehouse/bin mapping and production controls</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowBOMDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create BOM
          </Button>
        )}
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">BOM List</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search BOMs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="grid gap-4">
            {filteredBoms.map((bom) => (
              <Card key={bom.id}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {bom.bom_name}
                        {bom.production_ready ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Production Ready
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Draft
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Finished Product: {bom.finished_product_name} ({bom.finished_product_sku}) | Yield: {bom.yield_quantity} units
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {bom.production_ready && (
                        <Button
                          size="sm"
                          onClick={() => runProduction(bom)}
                          disabled={isProducing}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Produce
                        </Button>
                      )}
                      {canEdit && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadBOMForEdit(bom)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete BOM</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{bom.bom_name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteBOM(bom.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Material Cost:</span>
                      <p>₹{bom.material_cost_per_unit.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="font-medium">Labor Cost:</span>
                      <p>₹{bom.labor_cost_per_unit.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="font-medium">Overhead Cost:</span>
                      <p>₹{bom.overhead_cost_per_unit.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="font-medium">Total Cost:</span>
                      <p className="font-bold text-lg">₹{bom.total_cost_per_unit.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Production Dashboard
              </CardTitle>
              <CardDescription>Run production for BOMs marked as production ready</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <Label htmlFor="prodQty">Production Quantity:</Label>
                  <Input
                    id="prodQty"
                    type="number"
                    min="1"
                    value={productionQuantity}
                    onChange={(e) => setProductionQuantity(parseInt(e.target.value) || 1)}
                    className="w-24"
                  />
                </div>
                <div className="grid gap-4">
                  {boms.filter(bom => bom.production_ready).map((bom) => (
                    <div key={bom.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{bom.bom_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {bom.finished_product_name} | Cost: ₹{bom.total_cost_per_unit.toFixed(2)}/unit | Yield: {bom.yield_quantity} units
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total Cost: ₹{(bom.total_cost_per_unit * productionQuantity).toFixed(2)} | Will Produce: {bom.yield_quantity * productionQuantity} units
                        </p>
                      </div>
                      <Button
                        onClick={() => runProduction(bom)}
                        disabled={isProducing}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {isProducing ? 'Processing...' : 'Produce'}
                      </Button>
                    </div>
                  ))}
                  {boms.filter(bom => bom.production_ready).length === 0 && (
                    <EmptyState
                      icon={Package}
                      title="No BOMs marked as production ready"
                      description="Create a BOM and mark it production ready to run production."
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* BOM Create/Edit Dialog */}
      <Dialog open={showBOMDialog} onOpenChange={setShowBOMDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBOM ? 'Edit BOM' : 'Create New BOM'}
            </DialogTitle>
            <DialogDescription>
              Define the components and costs for manufacturing a finished product with proper warehouse/bin mapping
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-6">
            {/* Left Column: BOM Details */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">BOM Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="bomName">BOM Name *</Label>
                    <Input
                      id="bomName"
                      value={formData.bomName}
                      onChange={(e) => setFormData(prev => ({ ...prev, bomName: e.target.value }))}
                      placeholder="Enter BOM name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="finishedProduct">Finished Product *</Label>
                    <Select
                      value={formData.finishedProductId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, finishedProductId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select finished product" />
                      </SelectTrigger>
                      <SelectContent>
                        {finishedGoodsProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="yieldQuantity">Yield Quantity</Label>
                    <Input
                      id="yieldQuantity"
                      type="number"
                      min="1"
                      value={formData.yieldQuantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, yieldQuantity: parseInt(e.target.value) || 1 }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="laborCost">Labor Cost per Unit</Label>
                    <Input
                      id="laborCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.laborCost}
                      onChange={(e) => setFormData(prev => ({ ...prev, laborCost: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="overheadCost">Overhead Cost per Unit</Label>
                    <Input
                      id="overheadCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.overheadCost}
                      onChange={(e) => setFormData(prev => ({ ...prev, overheadCost: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="warehouse">Warehouse</Label>
                    <Select
                      value={selectedWarehouse}
                      onValueChange={(value) => {
                        setSelectedWarehouse(value);
                        setFormData(prev => ({ ...prev, warehouseId: '', binId: '' }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.name} value={warehouse.name}>
                            {warehouse.name} {warehouse.code && `(${warehouse.code})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="bin">Bin</Label>
                    <Select
                      value={formData.binId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, binId: value, warehouseId: value }))}
                      disabled={!selectedWarehouse}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bin" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredBins.map((bin) => (
                          <SelectItem key={bin.id} value={bin.id}>
                            {bin.bin_name} ({bin.wh_bin_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="productionReady"
                      checked={formData.productionReady}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, productionReady: checked }))}
                    />
                    <Label htmlFor="productionReady">Production Ready (default: 0)</Label>
                  </div>
                  {!formData.productionReady && (
                    <p className="text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      When disabled, no inventory actions will be performed during production
                    </p>
                  )}

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Center Column: Components */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Components</CardTitle>
                    <Button size="sm" onClick={addComponent}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {components.map((component) => (
                      <Card key={component.id} className="p-3">
                        <div className="space-y-3">
                          <Select
                            value={component.product_id || ''}
                            onValueChange={(value) => updateComponent(component.id, { product_id: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select component" />
                            </SelectTrigger>
                            <SelectContent>
                              {rawMaterialProducts.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.sku})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Quantity</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={component.quantity_per_unit}
                                onChange={(e) => updateComponent(component.id, { 
                                  quantity_per_unit: parseFloat(e.target.value) || 0 
                                })}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Unit Cost</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={component.unit_cost}
                                onChange={(e) => updateComponent(component.id, { 
                                  unit_cost: parseFloat(e.target.value) || 0 
                                })}
                                className="h-8"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Total: ₹{component.line_total.toFixed(2)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeComponent(component.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {components.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        No components added. Click "Add" to start.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Cost Summary */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Cost Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Material Cost:</span>
                      <span>₹{costSummary.material.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Labor Cost:</span>
                      <span>₹{costSummary.labor.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overhead Cost:</span>
                      <span>₹{costSummary.overhead.toFixed(2)}</span>
                    </div>
                    <hr />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total Cost per Unit:</span>
                      <span>₹{costSummary.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Production Preview</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span>Yield per Production:</span>
                            <span>{formData.yieldQuantity} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Cost per Production:</span>
                            <span>₹{costSummary.total.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Cost per Finished Unit:</span>
                            <span>₹{(costSummary.total / formData.yieldQuantity).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  onClick={saveBOM}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Saving...' : (editingBOM ? 'Update BOM' : 'Save BOM')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBOMDialog(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}