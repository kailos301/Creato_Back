import express from "express";
import auth from "../../middleware/auth";
const router = express.Router();

//import Controller
import {
    getReferralLinks,
    changeRewardDonuts,
    transferDonuts,
    getReferralLinkDetail
} from '../../controllers/referralController';

router.get("/", auth, getReferralLinks)
router.get("/:userId", auth, getReferralLinkDetail)
router.post('/change_reward', auth, changeRewardDonuts)
router.post('/send_donuts', auth, transferDonuts)

export default router;