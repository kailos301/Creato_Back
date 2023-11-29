import { Request, Response } from 'express'
import User from '../models/User'
import ReferralLink from '../models/ReferralLink'
import GeneralSetting from '../models/GeneralSetting';
import AdminWallet from '../models/AdminWallet';

function calcTime() {
  var d = new Date();
  var utc = d.getTime();
  var nd = new Date(utc + (3600000 * 8));
  return nd;
}


export const getReferralLinks = async (req: Request, res: Response) => {
  try {
    const result = await Promise.all([
      ReferralLink.find().populate({ path: 'user' }),
      GeneralSetting.findOne()
    ])
    const referrals = result[0]
    const settings: any = result[1]

    return res.status(200).json({ success: true, referrals: referrals, reward: settings.referralLinkDonuts })
  } catch (err) {
    console.log(err);
  }
}

export const changeRewardDonuts = async (req: Request, res: Response) => {
  try {
    const { donuts } = req.body
    await GeneralSetting.findOneAndUpdate({ referralLinkDonuts: donuts })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.log(err)
  }
}

export const transferDonuts = async (req: Request, res: Response) => {
  try {
    const { donuts, Id } = req.body
    const result: any = await Promise.all([
      AdminWallet.findOne(),
      ReferralLink.findOne({ user: Id }).populate({ path: 'user' }),
    ])
    const adminWallet = result[0].wallet
    const referral = result[1]
    const users = [...referral.invitedUsers]
    users.forEach((user: any) => { if (user.newUser && user.earned === false) user.earned = true })

    const result1 = await Promise.all([
      AdminWallet.findOneAndUpdate({ wallet: adminWallet - donuts }),
      User.findByIdAndUpdate(referral.user._id, { wallet: referral.user.wallet + donuts }),
      ReferralLink.findByIdAndUpdate(referral._id, { earned: referral.earned + donuts, invitedUsers: users }, { new: true }).populate([{ path: 'user' }, { path: 'invitedUsers.newUser' }])
    ])
    const updateReferral = result1[2]

    req.body.io.to(referral.user.email).emit("wallet_change", referral.user.wallet + donuts)
    req.body.io.to("ADMIN").emit("wallet_change", adminWallet - donuts)

    return res.status(200).json({ success: true, referral: updateReferral })
  } catch (err) {
    console.log(err)
  }
}

export const getReferralLinkDetail = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const referral = await ReferralLink.findOne({ user: userId }).populate([{ path: 'user' }, { path: 'invitedUsers.newUser' }])
    return res.status(200).json({ success: true, referral: referral })
  } catch (err) {
    console.log(err)
  }
}