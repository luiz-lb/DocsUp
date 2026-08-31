import express from 'express';
import auth from './auth.js';
import docRequired from './docRequired.js';
import laborRequest from './laborRequest.js';

const router = express.Router();

router.use('/auth', auth);
router.use('/docRequired', docRequired);
router.use('/laborRequest', laborRequest);

export default router;