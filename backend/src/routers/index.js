import express from 'express';
import auth from './auth.js';
import docRequired from './docRequired.js';
import laborRequest from './laborRequest.js';
import supplierAuth from './supplierAuth.js';
import suppliers from './suppliers.js';
import quotation from './quotation.js';
import phase2 from './phase2.js';
import documents from './documents.js';
import users from './users.js';
import auditLogs from './auditLogs.js';

const router = express.Router();

router.use('/auth', auth);
router.use('/docRequired', docRequired);
router.use('/laborRequest', laborRequest);
router.use('/supplier/auth', supplierAuth);
router.use('/suppliers', suppliers);
router.use('/quotations', quotation);
router.use('/phase2', phase2);
router.use('/documents', documents);
router.use('/users', users);
router.use('/audit-logs', auditLogs);

export default router;