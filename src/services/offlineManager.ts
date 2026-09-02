import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema
interface OfflineDB extends DBSchema {
  products: {
    key: string;
    value: any;
    indexes: {
      'by-sku': string;
      'by-category': string;
      'by-updated': number;
    };
  };
  orders: {
    key: string;
    value: any;
    indexes: {
      'by-status': string;
      'by-date': string;
    };
  };
  inventory: {
    key: string;
    value: any;
    indexes: {
      'by-product': string;
      'by-location': string;
    };
  };
  sync_queue: {
    key: number;
    value: {
      id?: number;
      table: string;
      action: 'create' | 'update' | 'delete';
      data: any;
      timestamp: number;
      synced: boolean;
    };
  };
  app_state: {
    key: string;
    value: any;
  };
}

class OfflineManager {
  private db: IDBPDatabase<OfflineDB> | null = null;
  private syncQueue: Array<any> = [];
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  async initialize() {
    try {
      this.db = await openDB<OfflineDB>('InventoryOfflineDB', 1, {
        upgrade(db) {
          // Products store
          const productsStore = db.createObjectStore('products', { keyPath: 'id' });
          productsStore.createIndex('by-sku', 'sku');
          productsStore.createIndex('by-category', 'category_id');
          productsStore.createIndex('by-updated', 'updated_at');

          // Orders store
          const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
          ordersStore.createIndex('by-status', 'status');
          ordersStore.createIndex('by-date', 'created_at');

          // Inventory store
          const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id' });
          inventoryStore.createIndex('by-product', 'product_id');
          inventoryStore.createIndex('by-location', 'warehouse_id');

          // Sync queue store
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });

          // App state store
          db.createObjectStore('app_state', { keyPath: 'key' });
        },
      });

      // Set up network listeners
      this.setupNetworkListeners();
      
      // Load sync queue
      await this.loadSyncQueue();
      
      // Auto-sync if online
      if (this.isOnline) {
        this.processSyncQueue();
      }

      console.log('Offline manager initialized');
    } catch (error) {
      console.error('Failed to initialize offline manager:', error);
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.onNetworkStatusChange(true);
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.onNetworkStatusChange(false);
    });
  }

  private onNetworkStatusChange(isOnline: boolean) {
    // Dispatch custom event for components to listen to
    const event = new CustomEvent('networkStatusChange', { 
      detail: { isOnline } 
    });
    window.dispatchEvent(event);
  }

  // Store operations
  async storeData(storeName: 'products' | 'orders' | 'inventory' | 'sync_queue' | 'app_state', data: any) {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(storeName, 'readwrite');
      if (Array.isArray(data)) {
        for (const item of data) {
          await tx.store.put(item);
        }
      } else {
        await tx.store.put(data);
      }
      await tx.done;
    } catch (error) {
      console.error(`Error storing data in ${storeName}:`, error);
    }
  }

  async getData(storeName: 'products' | 'orders' | 'inventory' | 'sync_queue' | 'app_state', key?: string) {
    if (!this.db) return null;

    try {
      if (key) {
        return await this.db.get(storeName, key);
      } else {
        return await this.db.getAll(storeName);
      }
    } catch (error) {
      console.error(`Error getting data from ${storeName}:`, error);
      return null;
    }
  }

  // Overloaded search methods for type safety
  async searchProducts(indexName: 'by-sku' | 'by-category' | 'by-updated', query: any) {
    if (!this.db) return [];

    try {
      const tx = this.db.transaction('products', 'readonly');
      return await tx.store.index(indexName).getAll(query);
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  async searchOrders(indexName: 'by-status' | 'by-date', query: any) {
    if (!this.db) return [];

    try {
      const tx = this.db.transaction('orders', 'readonly');
      return await tx.store.index(indexName).getAll(query);
    } catch (error) {
      console.error('Error searching orders:', error);
      return [];
    }
  }

  async searchInventory(indexName: 'by-product' | 'by-location', query: any) {
    if (!this.db) return [];

    try {
      const tx = this.db.transaction('inventory', 'readonly');
      return await tx.store.index(indexName).getAll(query);
    } catch (error) {
      console.error('Error searching inventory:', error);
      return [];
    }
  }

  // Generic search method for backward compatibility
  async searchData(storeName: 'products', indexName: 'by-sku' | 'by-category' | 'by-updated', query: any): Promise<any[]>;
  async searchData(storeName: 'orders', indexName: 'by-status' | 'by-date', query: any): Promise<any[]>;
  async searchData(storeName: 'inventory', indexName: 'by-product' | 'by-location', query: any): Promise<any[]>;
  async searchData(storeName: 'products' | 'orders' | 'inventory', indexName: string, query: any): Promise<any[]> {
    switch (storeName) {
      case 'products':
        return this.searchProducts(indexName as any, query);
      case 'orders':
        return this.searchOrders(indexName as any, query);
      case 'inventory':
        return this.searchInventory(indexName as any, query);
      default:
        return [];
    }
  }

  // Sync queue operations
  async addToSyncQueue(table: string, action: 'create' | 'update' | 'delete', data: any) {
    if (!this.db) return;

    const syncItem = {
      table,
      action,
      data,
      timestamp: Date.now(),
      synced: false
    };

    try {
      await this.db.add('sync_queue', syncItem);
      this.syncQueue.push(syncItem);

      // Auto-sync if online
      if (this.isOnline && !this.syncInProgress) {
        setTimeout(() => this.processSyncQueue(), 1000);
      }
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  }

  private async loadSyncQueue() {
    if (!this.db) return;

    try {
      this.syncQueue = await this.db.getAll('sync_queue');
      this.syncQueue = this.syncQueue.filter(item => !item.synced);
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  async processSyncQueue() {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const pendingItems = this.syncQueue.filter(item => !item.synced);
      
      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          
          // Mark as synced in database
          if (this.db && item.id) {
            await this.db.put('sync_queue', { ...item, synced: true });
          }
          
          // Remove from memory queue
          const index = this.syncQueue.findIndex(qi => qi.id === item.id);
          if (index !== -1) {
            this.syncQueue.splice(index, 1);
          }
        } catch (error) {
          console.error('Error syncing item:', error);
          // Continue with next item
        }
      }

      // Clean up synced items from database
      await this.cleanupSyncedItems();

    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncItem(item: any) {
    // This would integrate with your Supabase client
    // For now, we'll simulate the sync operation
    console.log('Syncing item:', item);
    
    // TODO: Implement actual sync with Supabase
    // Example:
    // const { supabase } = await import('@/integrations/supabase/client');
    // 
    // switch (item.action) {
    //   case 'create':
    //     await supabase.from(item.table).insert(item.data);
    //     break;
    //   case 'update':
    //     await supabase.from(item.table).update(item.data).eq('id', item.data.id);
    //     break;
    //   case 'delete':
    //     await supabase.from(item.table).delete().eq('id', item.data.id);
    //     break;
    // }
  }

  private async cleanupSyncedItems() {
    if (!this.db) return;

    try {
      const tx = this.db.transaction('sync_queue', 'readwrite');
      const allItems = await tx.store.getAll();
      const syncedItems = allItems.filter(item => item.synced);
      
      // Keep only recent synced items (last 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const item of syncedItems) {
        if (item.timestamp < oneDayAgo) {
          await tx.store.delete(item.id!);
        }
      }
      
      await tx.done;
    } catch (error) {
      console.error('Error cleaning up synced items:', error);
    }
  }

  // Network status
  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      pendingSyncItems: this.syncQueue.length,
      isSyncing: this.syncInProgress
    };
  }

  // App state management
  async saveAppState(key: string, value: any) {
    if (!this.db) return;

    try {
      await this.db.put('app_state', { key, value });
    } catch (error) {
      console.error('Error saving app state:', error);
    }
  }

  async getAppState(key: string) {
    if (!this.db) return null;

    try {
      const state = await this.db.get('app_state', key);
      return state?.value || null;
    } catch (error) {
      console.error('Error getting app state:', error);
      return null;
    }
  }

  // Cache management
  async clearCache(storeName?: 'products' | 'orders' | 'inventory' | 'sync_queue' | 'app_state') {
    if (!this.db) return;

    try {
      if (storeName) {
        await this.db.clear(storeName);
      } else {
        // Clear all stores except sync_queue and app_state
        await this.db.clear('products');
        await this.db.clear('orders');
        await this.db.clear('inventory');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Get cache statistics
  async getCacheStats() {
    if (!this.db) return null;

    try {
      const [products, orders, inventory, syncQueue] = await Promise.all([
        this.db.count('products'),
        this.db.count('orders'),
        this.db.count('inventory'),
        this.db.count('sync_queue')
      ]);

      return {
        products,
        orders,
        inventory,
        syncQueue,
        total: products + orders + inventory
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }
}

// Create singleton instance
export const offlineManager = new OfflineManager();

// Initialize when the module is loaded
if (typeof window !== 'undefined') {
  offlineManager.initialize();
}
