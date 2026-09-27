import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as inventory from '../controllers/inventoryController';

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

// UOMs
router.get('/uoms', authorize('inventory', 'uoms', 'view'), inventory.getUOMs);
router.post('/uoms', authorize('inventory', 'uoms', 'create'), inventory.createUOM);
router.put('/uoms/:id', authorize('inventory', 'uoms', 'edit'), inventory.updateUOM);

// Categories
router.get('/categories', authorize('inventory', 'categories', 'view'), inventory.getCategories);
router.post('/categories', authorize('inventory', 'categories', 'create'), inventory.createCategory);
router.put('/categories/:id', authorize('inventory', 'categories', 'edit'), inventory.updateCategory);

// Warehouses
router.get('/warehouses', authorize('inventory', 'warehouses', 'view'), inventory.getWarehouses);
router.post('/warehouses', authorize('inventory', 'warehouses', 'create'), inventory.createWarehouse);
router.put('/warehouses/:id', authorize('inventory', 'warehouses', 'edit'), inventory.updateWarehouse);

// Items
router.get('/items', authorize('inventory', 'items', 'view'), inventory.getItems);
router.post('/items', authorize('inventory', 'items', 'create'), inventory.createItem);
router.put('/items/:id', authorize('inventory', 'items', 'edit'), inventory.updateItem);

// Inventory Balances & Transactions
router.get('/balances', authorize('inventory', 'balances', 'view'), inventory.getInventoryBalances);
router.get('/transactions', authorize('inventory', 'transactions', 'view'), inventory.getTransactions);
router.post('/transactions', authorize('inventory', 'transactions', 'create'), inventory.createInventoryTransaction);

export default router;

