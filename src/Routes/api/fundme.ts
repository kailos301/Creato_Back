import express from 'express';
const router = express.Router();
import auth from "../../middleware/auth";

//import Controller
import {
    getDraftFundme,
    publishFundme,
    saveFundme,
    fundCreator,
    checkFundMeFinished,
    getFundMeDetails,
    getFundmeResult,
    deleteFundme,
    getFundMeList,
    setFundMeShow,
    updateFundMe,
    deleteFundMe
} from '../../controllers/fundmeController'

router.post("/draft", auth, getDraftFundme)
router.post("/save", auth, saveFundme)
router.post('/publish', auth, publishFundme)
router.get('/delete/:fundmeId', auth, deleteFundme)
router.get('/check/finished/:fundmeId', checkFundMeFinished)
router.get('/details/:fundmeId', getFundMeDetails)
router.get('/result/:fundmeId', getFundmeResult)
router.post('/fund/creator', auth, fundCreator)
// //admin
router.post('/fundmes', auth, getFundMeList)
router.post('/fundmes/:fundmeId', auth, setFundMeShow)
router.delete('/fundmes/:fundmeId', auth, deleteFundMe)
router.put('/fundmes/:fundmeId', auth, updateFundMe)
export default router;