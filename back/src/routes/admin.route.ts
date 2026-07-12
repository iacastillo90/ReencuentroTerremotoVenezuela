import { Router } from 'express';
import {
  mergeProfiles, getAuditJobs, mergeAuditJob, dismissAuditJob,
  updatePersonStatus, moderatePerson, putPerson, getPersonContacts,
  getAdminPersons, getAdminMatches, updateMatchStatus,
  getAdminUsers, updateUserRole, updateUserStatus,
  getVerifications, getAdminSearches,
  postApiKey, getApiKeys, deleteApiKey,
} from '../controllers/admin.controller';

const router = Router();

router.post('/merge/:id1/:id2', mergeProfiles);
router.get('/audit', getAuditJobs);
router.post('/audit/:jobId/merge', mergeAuditJob);
router.post('/audit/:jobId/dismiss', dismissAuditJob);
router.patch('/persons/:idHash/status', updatePersonStatus);
router.patch('/persons/:idHash/moderate', moderatePerson);
router.put('/persons/:idHash', putPerson);
router.get('/persons/:idHash/contacts', getPersonContacts);
router.get('/persons', getAdminPersons);
router.get('/matches', getAdminMatches);
router.patch('/matches/:id/status', updateMatchStatus);
router.get('/users', getAdminUsers);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);
router.get('/verifications', getVerifications);
router.get('/searches', getAdminSearches);
router.post('/api-keys', postApiKey);
router.get('/api-keys', getApiKeys);
router.delete('/api-keys/:id', deleteApiKey);

export const adminRouter = router;
