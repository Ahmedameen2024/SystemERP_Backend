import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as setup from '../controllers/setupController';
import * as cashBanks from '../controllers/cashBanksController';

const router = Router();

// All setup routes require authentication
router.use(authenticate);

// Company Profile
router.get('/company', setup.getCompany);
router.put('/company', authorize('system', 'company_profile', 'edit'), setup.updateCompany);

// Branches
router.get('/branches', authorize('system', 'branches', 'view'), setup.getBranches);
router.post('/branches', authorize('system', 'branches', 'create'), setup.createBranch);
router.put('/branches/:id', authorize('system', 'branches', 'edit'), setup.updateBranch);
router.delete('/branches/:id', authorize('system', 'branches', 'delete'), setup.deleteBranch);

// Currencies
router.get('/currencies', setup.getCurrencies);
router.post('/currencies', authorize('system', 'currencies', 'create'), setup.createCurrency);
router.put('/currencies/:id', authorize('system', 'currencies', 'edit'), setup.updateCurrency);

// Exchange Rates
router.get('/exchange-rates', authorize('system', 'exchange_rates', 'view'), setup.getExchangeRates);
router.post('/exchange-rates', authorize('system', 'exchange_rates', 'create'), setup.createExchangeRate);

// Users
router.get('/users', authorize('system', 'users', 'view'), setup.getUsers);
router.post('/users', authorize('system', 'users', 'create'), setup.createUser);
router.put('/users/:id', authorize('system', 'users', 'edit'), setup.updateUser);

// Roles
router.get('/roles', setup.getRoles);
router.post('/roles', authorize('system', 'roles', 'create'), setup.createRole);
router.put('/roles/:id', authorize('system', 'roles', 'edit'), setup.updateRole);
router.delete('/roles/:id', authorize('system', 'roles', 'delete'), setup.deleteRole);
router.post('/roles/seed-defaults', authorize('system', 'roles', 'create'), setup.seedDefaultRoles);

// Permissions
router.get('/permissions/registry', setup.getPermissionRegistry);
router.get('/permissions/:roleId', authorize('system', 'permissions', 'view'), setup.getPermissions);
router.put('/permissions/:roleId', authorize('system', 'permissions', 'edit'), setup.updatePermissions);

// Settings
router.get('/settings', setup.getSettings);
router.put('/settings', authorize('system', 'company_profile', 'edit'), setup.updateSettings);

// Lookup data (available to all authenticated users)
router.get('/payment-methods', setup.getPaymentMethods);
router.get('/taxes', setup.getTaxes);
router.get('/departments', setup.getDepartments);
router.post('/departments', authorize('system', 'branches', 'create'), setup.createDepartment);
router.get('/suppliers', setup.getSuppliers);
router.post('/suppliers', setup.createSupplier);
router.put('/suppliers/:id', setup.updateSupplier);
router.get('/financial-periods', setup.getFinancialPeriods);

// Cash & Bank Masters under Setup
router.get('/cash-boxes', cashBanks.getCashBoxes);
router.get('/cash-boxes/:id', cashBanks.getCashBoxById);
router.post('/cash-boxes', authorize('system', 'cash_boxes', 'create'), cashBanks.createCashBox);
router.put('/cash-boxes/:id', authorize('system', 'cash_boxes', 'edit'), cashBanks.updateCashBox);
router.delete('/cash-boxes/:id', authorize('system', 'cash_boxes', 'delete'), cashBanks.deleteCashBox);

router.get('/bank-accounts', cashBanks.getBankAccounts);
router.get('/bank-accounts/:id', cashBanks.getBankAccountById);
router.post('/bank-accounts', authorize('system', 'bank_accounts', 'create'), cashBanks.createBankAccount);
router.put('/bank-accounts/:id', authorize('system', 'bank_accounts', 'edit'), cashBanks.updateBankAccount);
router.delete('/bank-accounts/:id', authorize('system', 'bank_accounts', 'delete'), cashBanks.deleteBankAccount);

// Currency Transfers & FX Exchange
router.get('/currency-transfers', cashBanks.getCurrencyTransfers);
router.post('/currency-transfers', cashBanks.createCurrencyTransfer);

export default router;
