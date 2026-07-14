/**
 * routes/admin.route.ts — Rutas de administración
 *
 * PROPÓSITO:
 *   Define 15+ endpoints administrativos para gestión completa del sistema:
 *   moderación de personas, usuarios, API keys, matches, fusiones, y auditoría.
 *   Todos protegidos con rate limiting + requireAdminApiKey middleware.
 *
 * ENDPOINTS:
 *   Personas:
 *     PATCH  /api/admin/persons/:idHash/status — Cambiar estado (found/deceased/...)
 *     PATCH  /api/admin/persons/:idHash/moderate — Moderar (auditStatus)
 *     PUT    /api/admin/persons/:idHash — Edición completa
 *     GET    /api/admin/persons/:idHash/contacts — Contactos de un perfil
 *     GET    /api/admin/persons — Listar personas (paginado, filtros)
 *
 *   Fusión:
 *     POST   /api/admin/merge/:id1/:id2 — Fusionar 2 perfiles
 *     GET    /api/admin/audit — Jobs de auditoría
 *     POST   /api/admin/audit/:jobId/merge — Aprobar fusión sugerida
 *     POST   /api/admin/audit/:jobId/dismiss — Rechazar fusión sugerida
 *
 *   Usuarios:
 *     GET    /api/admin/users — Listar usuarios
 *     PATCH  /api/admin/users/:id/role — Cambiar rol (user/verifier/admin)
 *     PATCH  /api/admin/users/:id/status — Cambiar estado (pending/approved/banned)
 *     GET    /api/admin/verifications — Solicitudes de verificación
 *
 *   Matches:
 *     GET    /api/admin/matches — Listar matches
 *     PATCH  /api/admin/matches/:id/status — Aprobar/rechazar match
 *
 *   API Keys:
 *     POST   /api/admin/api-keys — Crear nueva API key
 *     GET    /api/admin/api-keys — Listar API keys
 *     DELETE /api/admin/api-keys/:id — Revocar API key
 *
 *   Búsquedas:
 *     GET    /api/admin/searches — Listar solicitudes de búsqueda
 *
 * RATE LIMITING:
 *   adminLimiter: 100 req/15min (suficiente para operaciones admin normales)
 *
 * SEGURIDAD:
 *   - requireAdminApiKey: API key específica de admin en header x-api-key
 *   - adminLimiter: Previene brute force en endpoints admin
 *   - Zod validation en cada handler: Previene NoSQL injection
 *   - Audit log en operaciones críticas (merge, moderate, change role)
 *
 * CÓMO USAR:
 *   # Moderar una persona
 *   curl -X PATCH /api/admin/persons/abc123/moderate \
 *     -H 'x-api-key: admin-key' \
 *     -d '{"action": "approve"}'
 *
 *   # Listar usuarios
 *   curl GET /api/admin/users -H 'x-api-key: admin-key'
 *
 *   # Crear API key de partner
 *   curl -X POST /api/admin/api-keys \
 *     -H 'x-api-key: admin-key' \
 *     -d '{"type": "partner", "label": "Cruz Roja"}'
 */
import { Router } from 'express';
import {
  mergeProfilesHandler, getAuditJobsHandler, mergeAuditJobHandler, dismissAuditJobHandler,
  updatePersonStatusHandler, moderatePersonHandler, putPersonHandler, getPersonContactsHandler,
  getAdminPersonsHandler, getAdminMatchesHandler, updateMatchStatusHandler,
  getAdminUsersHandler, updateUserRoleHandler, updateUserStatusHandler,
  getVerificationsHandler, getAdminSearchesHandler,
  postApiKeyHandler, getApiKeysHandler, deleteApiKeyHandler,
  getAuditLogsHandler,
  getLopnnaFlaggedHandler, lopnnaBlurHandler, lopnnaDeletePhotoHandler, lopnnaFalsePositiveHandler,
} from '../controllers/admin.controller';
import rateLimit from 'express-rate-limit';

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to admin endpoints. Try again later.' }
});

const router = Router();
router.use(adminLimiter);

router.post('/merge/:id1/:id2', mergeProfilesHandler);
router.get('/audit', getAuditJobsHandler);
router.post('/audit/:jobId/merge', mergeAuditJobHandler);
router.post('/audit/:jobId/dismiss', dismissAuditJobHandler);
router.get('/audit-logs', getAuditLogsHandler);
router.patch('/persons/:idHash/status', updatePersonStatusHandler);
router.patch('/persons/:idHash/moderate', moderatePersonHandler);
router.put('/persons/:idHash', putPersonHandler);
router.get('/persons/:idHash/contacts', getPersonContactsHandler);
router.get('/persons', getAdminPersonsHandler);
router.get('/matches', getAdminMatchesHandler);
router.patch('/matches/:id/status', updateMatchStatusHandler);
router.get('/users', getAdminUsersHandler);
router.patch('/users/:id/role', updateUserRoleHandler);
router.patch('/users/:id/status', updateUserStatusHandler);
router.get('/verifications', getVerificationsHandler);
router.get('/searches', getAdminSearchesHandler);
router.post('/api-keys', postApiKeyHandler);
router.get('/api-keys', getApiKeysHandler);
router.delete('/api-keys/:id', deleteApiKeyHandler);

// ─── LOPNNA — Protección de Menores ─────────────────────────────────
router.get('/lopnna/flagged', getLopnnaFlaggedHandler);
router.post('/lopnna/:idHash/blur', lopnnaBlurHandler);
router.post('/lopnna/:idHash/delete-photo', lopnnaDeletePhotoHandler);
router.post('/lopnna/:idHash/false-positive', lopnnaFalsePositiveHandler);

export const adminRouter = router;
