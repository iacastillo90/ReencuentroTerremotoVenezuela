import { Router } from 'express';
import {
  mergeProfilesHandler, getAuditJobsHandler, mergeAuditJobHandler, dismissAuditJobHandler,
  updatePersonStatusHandler, moderatePersonHandler, putPersonHandler, getPersonContactsHandler,
  getAdminPersonsHandler, getAdminMatchesHandler, updateMatchStatusHandler,
  getAdminUsersHandler, updateUserRoleHandler, updateUserStatusHandler,
  getVerificationsHandler, getAdminSearchesHandler,
  postApiKeyHandler, getApiKeysHandler, deleteApiKeyHandler,
} from '../controllers/admin.controller';

const router = Router();

router.post('/merge/:id1/:id2', mergeProfilesHandler);
router.get('/audit', getAuditJobsHandler);
router.post('/audit/:jobId/merge', mergeAuditJobHandler);
router.post('/audit/:jobId/dismiss', dismissAuditJobHandler);
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

export const adminRouter = router;
