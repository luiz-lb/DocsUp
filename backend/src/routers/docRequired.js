import express from 'express';
import * as docRequired from '../controllers/docRequiredController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// router para pegar os tipos de atividades disponivel para solicitação
router.get('/activity_types', verificarToken, docRequired.activityTypes);
// router para pegar os tipos de NRs disponivel para exigir
router.get('/nr_types', verificarToken, docRequired.nr_types);
// router para pegar os tipos de documentos disponivel para solicitação=
router.get('/document_types', verificarToken, docRequired.document_types);

export default router;