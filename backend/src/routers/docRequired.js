import express from 'express';
import * as docRequired from '../controllers/docRequiredController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Rotas internas (colaboradores autenticados) ────────────────────────────
router.get('/activity_types',  verificarToken, docRequired.activityTypes);
router.get('/nr_types',        verificarToken, docRequired.nr_types);
router.get('/document_types',  verificarToken, docRequired.document_types);

// ── Rotas públicas (portal do fornecedor — sem JWT interno) ────────────────
// Atividades: usadas no step "Atuação" do cadastro de fornecedor
router.get('/public/activity_types', docRequired.activityTypesPublic);

// Regiões: busca por cidade/estado para o autocomplete do cadastro
router.get('/public/regions',              docRequired.searchRegions);
router.get('/public/regions/state/:state', docRequired.getRegionIdsByState);

export default router;
