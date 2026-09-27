import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as purchasing from '../controllers/purchasingController';
import * as purchasingV2 from '../controllers/purchasingV2Controller';

const router = Router();
router.use(authenticate);

// ============================================================
// SUPPLIER GROUPS
// ============================================================
router.get('/supplier-groups', purchasingV2.getSupplierGroups);
router.post('/supplier-groups', authorize('purchasing', 'supplier_groups', 'create'), purchasingV2.createSupplierGroup);
router.put('/supplier-groups/:id', authorize('purchasing', 'supplier_groups', 'edit'), purchasingV2.updateSupplierGroup);
router.delete('/supplier-groups/:id', authorize('purchasing', 'supplier_groups', 'delete'), purchasingV2.deleteSupplierGroup);

// ============================================================
// SUPPLIER TYPES
// ============================================================
router.get('/supplier-types', purchasingV2.getSupplierTypes);
router.post('/supplier-types', authorize('purchasing', 'supplier_types', 'create'), purchasingV2.createSupplierType);
router.put('/supplier-types/:id', authorize('purchasing', 'supplier_types', 'edit'), purchasingV2.updateSupplierType);
router.delete('/supplier-types/:id', authorize('purchasing', 'supplier_types', 'delete'), purchasingV2.deleteSupplierType);

// ============================================================
// PAYMENT TERMS
// ============================================================
router.get('/payment-terms', purchasingV2.getPaymentTerms);
router.post('/payment-terms', authorize('purchasing', 'payment_terms', 'create'), purchasingV2.createPaymentTerm);
router.put('/payment-terms/:id', authorize('purchasing', 'payment_terms', 'edit'), purchasingV2.updatePaymentTerm);
router.delete('/payment-terms/:id', authorize('purchasing', 'payment_terms', 'delete'), purchasingV2.deletePaymentTerm);

// ============================================================
// SUPPLIERS (Enhanced)
// ============================================================
router.get('/suppliers', purchasingV2.getSuppliers);
router.post('/suppliers', authorize('purchasing', 'suppliers', 'create'), purchasingV2.createSupplier);
router.put('/suppliers/:id', authorize('purchasing', 'suppliers', 'edit'), purchasingV2.updateSupplier);
router.get('/suppliers/:id', authorize('purchasing', 'suppliers', 'view'), purchasingV2.getSupplierById);
router.patch('/suppliers/:id/status', authorize('purchasing', 'suppliers', 'edit'), purchasingV2.toggleSupplierStatus);

// Supplier Profile
router.get('/suppliers/:id/overview', authorize('purchasing', 'suppliers', 'view'), purchasingV2.getSupplierOverview);
router.get('/suppliers/:id/statement', authorize('purchasing', 'suppliers', 'view'), purchasingV2.getSupplierStatement);
router.get('/suppliers/:id/purchases', authorize('purchasing', 'suppliers', 'view'), purchasingV2.getSupplierPurchases);
router.get('/suppliers/:id/payments', authorize('purchasing', 'suppliers', 'view'), purchasingV2.getSupplierPayments);

// Supplier Evaluations
router.get('/suppliers/:id/evaluations', authorize('purchasing', 'suppliers', 'view'), purchasingV2.getSupplierEvaluations);
router.post('/suppliers/:id/evaluations', authorize('purchasing', 'suppliers', 'edit'), purchasingV2.createSupplierEvaluation);

// ============================================================
// PURCHASE REQUESTS
// ============================================================
router.get('/requests', authorize('purchasing', 'purchase_requests', 'view'), purchasingV2.getPurchaseRequests);
router.get('/requests/:id', authorize('purchasing', 'purchase_requests', 'view'), purchasingV2.getPurchaseRequestById);
router.post('/requests', authorize('purchasing', 'purchase_requests', 'create'), purchasingV2.createPurchaseRequest);
router.post('/requests/:id/approve', authorize('purchasing', 'purchase_requests', 'approve'), purchasingV2.approvePurchaseRequest);
router.post('/requests/:id/convert', authorize('purchasing', 'purchase_orders', 'create'), purchasingV2.convertRequestToOrder);

// ============================================================
// PURCHASE ORDERS (Enhanced)
// ============================================================
router.get('/orders', authorize('purchasing', 'purchase_orders', 'view'), purchasingV2.getPurchaseOrders);
router.get('/orders/:id', authorize('purchasing', 'purchase_orders', 'view'), purchasingV2.getPurchaseOrderById);
router.post('/orders', authorize('purchasing', 'purchase_orders', 'create'), purchasingV2.createPurchaseOrder);
router.post('/orders/:id/approve', authorize('purchasing', 'purchase_orders', 'approve'), purchasingV2.approvePurchaseOrder);
router.post('/orders/:id/cancel', authorize('purchasing', 'purchase_orders', 'approve'), purchasingV2.cancelPurchaseOrder);

// ============================================================
// PURCHASE RECEIPTS
// ============================================================
router.get('/receipts', authorize('purchasing', 'purchase_receipts', 'view'), purchasingV2.getPurchaseReceipts);
router.post('/receipts', authorize('purchasing', 'purchase_receipts', 'create'), purchasingV2.createPurchaseReceipt);
router.post('/receipts/:id/post', authorize('purchasing', 'purchase_receipts', 'approve'), purchasingV2.postPurchaseReceipt);

// ============================================================
// PURCHASE RETURNS
// ============================================================
router.get('/returns', authorize('purchasing', 'purchase_returns', 'view'), purchasingV2.getPurchaseReturns);
router.post('/returns', authorize('purchasing', 'purchase_returns', 'create'), purchasingV2.createPurchaseReturn);
router.post('/returns/:id/post', authorize('purchasing', 'purchase_returns', 'approve'), purchasingV2.postPurchaseReturn);

// ============================================================
// DASHBOARD (Real Data)
// ============================================================
router.get('/dashboard', purchasingV2.getPurchasingDashboard);

// ============================================================
// REPORTS
// ============================================================
router.get('/reports/supplier-balances', authorize('purchasing', 'reports', 'view'), purchasingV2.getSupplierBalances);
router.get('/reports/supplier-aging', authorize('purchasing', 'reports', 'view'), purchasingV2.getSupplierAging);
router.get('/reports/purchases-by-supplier', authorize('purchasing', 'reports', 'view'), purchasingV2.getPurchasesBySupplier);

// ============================================================
// PURCHASE INVOICES (Original - preserved)
// ============================================================
router.get('/invoices', authorize('purchasing', 'purchase_invoices', 'view'), purchasing.getPurchaseInvoices);
router.get('/invoices/:id', authorize('purchasing', 'purchase_invoices', 'view'), purchasing.getPurchaseInvoiceById);
router.post('/invoices', authorize('purchasing', 'purchase_invoices', 'create'), purchasing.createPurchaseInvoice);
router.put('/invoices/:id', authorize('purchasing', 'purchase_invoices', 'edit'), purchasing.updatePurchaseInvoice);
router.delete('/invoices/:id', authorize('purchasing', 'purchase_invoices', 'delete'), purchasing.deletePurchaseInvoice);
router.post('/invoices/:id/post', authorize('purchasing', 'purchase_invoices', 'approve'), purchasing.postPurchaseInvoice);
router.post('/invoices/:id/void', authorize('purchasing', 'purchase_invoices', 'approve'), purchasing.voidPurchaseInvoice);

export default router;
