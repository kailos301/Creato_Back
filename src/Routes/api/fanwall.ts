import express from 'express';
const router = express.Router();
import auth from "../../middleware/auth";
import {
  saveFanwall,
  uploadFile,
  fanwallGetByDareMeId,
  fanwallGetByFundMeId,
  getPostDetail,
  getFanwallsByPersonalUrl,
  likeFanwall,
  unlockFanwall,
  deleteFanwall,
  modityIssue,
  getTransaction,
  setTransaction,
  setUser,
  checkTransaction,
  dumpFanwall,
  getFanwallList
} from '../../controllers/fanwallController';

router.post('/personalUrl', getFanwallsByPersonalUrl)
router.post('/like', auth, likeFanwall);
router.post('/unlock', auth, unlockFanwall);
router.get('/dareme/:daremeId', fanwallGetByDareMeId);
router.get('/fundme/:fundmeId', fanwallGetByFundMeId);
router.get('/getById/:fanwallId', getPostDetail);
router.post('/upload', auth, uploadFile);
router.post('/save', auth, saveFanwall);

router.get('/modify', modityIssue);
router.get('/get/:transactionId', getTransaction);
router.get('/set/user', setUser);
router.get('/check/:transactionId', checkTransaction);
router.post('/set/:transactionId', setTransaction);

router.delete('/:fanwallId', auth, deleteFanwall);
router.get('/get/fanwall/all', dumpFanwall)
router.get('/fanwalls', auth, getFanwallList)


export default router;