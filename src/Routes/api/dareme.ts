import express from 'express';
const router = express.Router();
import auth from "../../middleware/auth";

//import Controller
import {
    getDraftDareme,
    uploadFile,
    publishDareme,
    getDaremesByPersonalUrl,
    getDaremesOngoing,
    saveDareme,
    supportCreator,
    dareCreator,
    declineDareOption,
    acceptDareOption,
    winDareOption,
    checkDareMeFinished,
    getDareMeDetails,
    getDaremeResult,
    getDareCreatorDetails,
    checkDareMeRequests,
    getDareMeRequests,
    deleteDareme,
    selectCover,
    getDareMeList,
    setDareMeShow,
    updateDareMe,
    deleteOption,
    getDaremeVoters,
    checkRefundPossible,
    refundDonuts,
    supportRefund
} from '../../controllers/daremeController'

router.post("/draft", auth, getDraftDareme);
router.post("/save", auth, saveDareme);
router.post('/save/upload', auth, uploadFile);
router.post('/publish', auth, publishDareme);
router.get('/delete/:daremeId', auth, deleteDareme);
router.post('/save/cover', auth, selectCover);

router.get('/ongoingDaremes', getDaremesOngoing);
router.post('/personalUrl', getDaremesByPersonalUrl);
router.get('/check/finished/:daremeId', checkDareMeFinished);
router.get('/details/:daremeId', getDareMeDetails)
router.get('/result/:daremeId', getDaremeResult);
router.post('/support', auth, supportCreator);
router.get('/dare/:daremeId', getDareCreatorDetails);
router.post('/dare/creator', auth, dareCreator);
router.get('/check/requests/:daremeId', checkDareMeRequests);
router.get('/requests/:daremeId', getDareMeRequests);
router.post('/decline', auth, declineDareOption);
router.post('/accept', auth, acceptDareOption);
router.post('/win/option', auth, winDareOption);
router.get('/:daremeId/voters', auth, getDaremeVoters);
router.get('/:daremeId/refund_possible', auth, checkRefundPossible);
router.post('/:daremeId/refund_donuts', auth, refundDonuts)
router.get('/:daremeId/support_refund', auth, supportRefund)
//admin
router.post('/daremes', auth, getDareMeList);
router.post('/daremes/:daremeId', auth, setDareMeShow);
router.delete('/daremes/:daremeId', auth, deleteDareme);
router.put('/daremes/:daremeId', auth, updateDareMe);
router.delete('/daremes/:daremeId/options/:optionId', auth, deleteOption);

export default router;