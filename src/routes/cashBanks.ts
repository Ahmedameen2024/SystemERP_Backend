import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as cashBanks from '../controllers/cashBanksController';

const router = Router();

// All cash-banks routes require authentication
router.use(authenticate);

// Cash Boxes Routes
router.get('/cash-boxes', cashBanks.getCashBoxes);
router.get('/cash-boxes/:id', cashBanks.getCashBoxById);
router.post('/cash-boxes', authorize('system', 'cash_boxes', 'create'), cashBanks.createCashBox);
router.put('/cash-boxes/:id', authorize('system', 'cash_boxes', 'edit'), cashBanks.updateCashBox);
router.delete('/cash-boxes/:id', authorize('system', 'cash_boxes', 'delete'), cashBanks.deleteCashBox);

// Bank Accounts Routes
router.get('/bank-accounts', cashBanks.getBankAccounts);
router.get('/bank-accounts/:id', cashBanks.getBankAccountById);
router.post('/bank-accounts', authorize('system', 'bank_accounts', 'create'), cashBanks.createBankAccount);
router.put('/bank-accounts/:id', authorize('system', 'bank_accounts', 'edit'), cashBanks.updateBankAccount);
router.delete('/bank-accounts/:id', authorize('system', 'bank_accounts', 'delete'), cashBanks.deleteBankAccount);

export default router;
