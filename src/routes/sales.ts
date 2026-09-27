import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as sales from '../controllers/salesController';

const router = Router();
router.use(authenticate);

// Customers
router.get('/customers', authorize('sales', 'customers', 'view'), sales.getCustomers);
router.post('/customers', authorize('sales', 'customers', 'create'), sales.createCustomer);
router.put('/customers/:id', authorize('sales', 'customers', 'edit'), sales.updateCustomer);

// Customer Statement
router.get('/customers/:customerId/statement', authorize('sales', 'customers', 'view'), sales.getCustomerStatement);

// Sales Invoices
router.get('/invoices', authorize('sales', 'sales_invoices', 'view'), sales.getSalesInvoices);
router.get('/invoices/:id', authorize('sales', 'sales_invoices', 'view'), sales.getSalesInvoiceById);
router.post('/invoices', authorize('sales', 'sales_invoices', 'create'), sales.createSalesInvoice);
router.put('/invoices/:id', authorize('sales', 'sales_invoices', 'edit'), sales.updateSalesInvoice);
router.delete('/invoices/:id', authorize('sales', 'sales_invoices', 'delete'), sales.deleteSalesInvoice);
router.post('/invoices/:id/post', authorize('sales', 'sales_invoices', 'approve'), sales.postSalesInvoice);
router.post('/invoices/:id/void', authorize('sales', 'sales_invoices', 'approve'), sales.voidSalesInvoice);

// Sales Returns
router.get('/returns', authorize('sales', 'sales_returns', 'view'), sales.getSalesReturns);
router.post('/returns', authorize('sales', 'sales_returns', 'create'), sales.createSalesReturn);

// Dashboard & Reports
router.get('/dashboard-stats', authorize('sales', 'sales_invoices', 'view'), sales.getSalesDashboardStats);

export default router;

