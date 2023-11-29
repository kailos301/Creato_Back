import express from "express";
const router = express.Router();
import auth from "../../middleware/auth";

import {
    getTransactions,
    addAdminDonuts,
    transferDonuts,
    getUserLatest5Transactions,
    getUserTransactionsByDays
} from "../../controllers/transactionController";

router.get("/:type", auth, getTransactions);
router.post("/add/adminDonuts", auth, addAdminDonuts);
router.post("/transfer/donuts", auth, transferDonuts);
router.get('/user/latest', auth, getUserLatest5Transactions);
router.post('/user/days', auth, getUserTransactionsByDays);

export default router;