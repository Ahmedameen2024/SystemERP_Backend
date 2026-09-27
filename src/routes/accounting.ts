import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as accounting from '../controllers/accountingController';

const router = Router();

// All accounting routes require authentication
router.use(authenticate);

// GL Accounts
router.get('/accounts', authorize('accounting', 'chart_of_accounts', 'view'), accounting.getAccounts);
router.post('/accounts', authorize('accounting', 'chart_of_accounts', 'create'), accounting.createAccount);
router.put('/accounts/:id', authorize('accounting', 'chart_of_accounts', 'edit'), accounting.updateAccount);

// Cost Centers
router.get('/cost-centers', authorize('accounting', 'cost_centers', 'view'), accounting.getCostCenters);
router.post('/cost-centers', authorize('accounting', 'cost_centers', 'create'), accounting.createCostCenter);
router.put('/cost-centers/:id', authorize('accounting', 'cost_centers', 'edit'), accounting.updateCostCenter);

// Journal Entries
router.get('/journal-entries', authorize('accounting', 'journal_entries', 'view'), accounting.getJournalEntries);
router.get('/journal-entries/:id', authorize('accounting', 'journal_entries', 'view'), accounting.getJournalEntryById);
router.post('/journal-entries', authorize('accounting', 'journal_entries', 'create'), accounting.createJournalEntry);
router.put('/journal-entries/:id', authorize('accounting', 'journal_entries', 'edit'), accounting.updateJournalEntry);
router.put('/journal-entries/:id/status', authorize('accounting', 'journal_entries', 'edit'), accounting.updateJournalEntryStatus);

// Opening Balances
router.get('/opening-balances', authorize('accounting', 'opening_balances', 'view'), accounting.getOpeningBalances);
router.post('/opening-balances', authorize('accounting', 'opening_balances', 'create'), accounting.createOpeningBalance);
router.put('/opening-balances/:id', authorize('accounting', 'opening_balances', 'edit'), accounting.updateOpeningBalance);
router.delete('/opening-balances/:id', authorize('accounting', 'opening_balances', 'delete'), accounting.deleteOpeningBalance);
router.post('/opening-balances/:id/post', authorize('accounting', 'opening_balances', 'approve'), accounting.postOpeningBalance);


// Receipt Vouchers
router.get('/receipt-vouchers', authorize('vouchers', 'receipt_vouchers', 'view'), accounting.getReceiptVouchers);
router.post('/receipt-vouchers', authorize('vouchers', 'receipt_vouchers', 'create'), accounting.createReceiptVoucher);
router.put('/receipt-vouchers/:id/status', authorize('vouchers', 'receipt_vouchers', 'edit'), accounting.updateReceiptVoucherStatus);

// Payment Vouchers
router.get('/payment-vouchers', authorize('vouchers', 'payment_vouchers', 'view'), accounting.getPaymentVouchers);
router.post('/payment-vouchers', authorize('vouchers', 'payment_vouchers', 'create'), accounting.createPaymentVoucher);
router.put('/payment-vouchers/:id/status', authorize('vouchers', 'payment_vouchers', 'edit'), accounting.updatePaymentVoucherStatus);

export default router;
