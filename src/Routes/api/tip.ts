import express from "express";
import auth from "../../middleware/auth";
const router = express.Router();

//import Controller
import {
    tipUser,
    buyDonutForTip,
    getTipsData,
    getTipProfile,
    setTipFunction,
    changeVisible,
    getTipData,
    updateTip,
    deleteTip,
    getActiveTipUsers,
    setTipFunctionByUser
} from '../../controllers/tipController';

router.post("/", tipUser);
router.post("/buy", buyDonutForTip);
router.get('/list', auth, getTipsData);
router.get('/profile/:url', auth, getTipProfile);
router.post('/profile/tipsetting', auth, setTipFunction);
router.post('/profile/changevisible', auth, changeVisible);
router.get('/:id', auth, getTipData);
router.post('/:id/update', auth, updateTip);
router.delete('/:id', auth, deleteTip);
router.get('/users/tipactive', auth, getActiveTipUsers);
router.post('/profile_edit/tipsetting', auth, setTipFunctionByUser)

export default router;