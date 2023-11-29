import express from "express";
const router = express.Router();
import auth from "../../middleware/auth";

import {
  getNotifications,
  readNotification,
  subscribeUser,
  addNotificationSetting,
  getNotificationSetting,
  addNotificationType,
  getNotificationType,
  setNotificationAuto,
  setNotification,
  getNotificationHistory
} from "../../controllers/notificationController";

router.get("/get_notifications", auth, getNotifications);
router.post("/subscribe_user/:id", auth, subscribeUser);
router.get('/setting', auth, getNotificationSetting);
router.post('/setting', auth, addNotificationSetting);
router.get('/type', auth, getNotificationType);
router.post('/type', auth, addNotificationType);
router.put('/type', auth, setNotificationAuto);
router.get('/set', auth, setNotification);
router.get('/', auth, getNotifications);
router.post('/read', auth, readNotification);
router.get('/history', auth, getNotificationHistory);

export default router;
