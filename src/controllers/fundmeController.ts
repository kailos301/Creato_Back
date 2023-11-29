import { Request, Response } from "express"
import fs from "fs"
import FundMe from "../models/FundMe"
import User from "../models/User"
import Fanwall from "../models/Fanwall"
import AdminUserTransaction from "../models/AdminUserTransaction"
import { addNewNotification } from '../controllers/notificationController'

function calcTime() {
  var d = new Date();
  var utc = d.getTime();
  var nd = new Date(utc + (3600000 * 8));
  return nd;
}


///// CLEAN -----------------------------
export const fundCreator = async (req: Request, res: Response) => {
  try {
    const { fundmeId, amount, userId } = req.body
    const result = await Promise.all([
      User.findById(userId),
      FundMe.findById(fundmeId).populate({ path: 'owner' })
    ])

    const user: any = result[0]
    const fundme: any = result[1]

    let voteInfo = fundme.voteInfo
    let filters = voteInfo.filter((vote: any) => (vote.voter + "") === (userId + ""))
    if (filters.length) {
      voteInfo = voteInfo.map((vote: any) => {
        if ((vote.voter + "") === (userId + "")) {
          vote.donuts = vote.donuts + amount
          if (amount >= fundme.reward) vote.superfan = true
        }
        return vote
      })
    } else voteInfo.push({
      voter: userId,
      donuts: amount,
      canFree: true,
      superfan: amount >= fundme.reward ? true : false
    })

    let fundmeWallet = fundme.wallet + amount
    const userWallet = user.wallet - amount

    const result1: any = await Promise.all([
      FundMe.findByIdAndUpdate(fundme._id, { wallet: fundmeWallet, voteInfo: voteInfo }, { new: true }).populate([{ path: 'owner' }, { path: 'voteInfo.voter' }]),
      User.findByIdAndUpdate(user._id, { wallet: userWallet }, { new: true })
    ])
    const updateFundme = result1[0]
    const updatedUser = result1[1]

    const fundmePayload = {
      ...updateFundme._doc,
      time: Math.round((new Date(updateFundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * updateFundme.deadline) / 1000),
    }
    const payload = {
      ...updatedUser._doc,
      id: updatedUser._id
    }

    req.body.io.to(updatedUser.email).emit("wallet_change", updatedUser.wallet)

    if (amount < updateFundme.reward) {
      const transaction = new AdminUserTransaction({
        description: 11,
        from: "USER",
        to: "FUNDME",
        user: userId,
        fundme: fundmeId,
        donuts: amount,
        date: calcTime()
      })
      await transaction.save()

      addNewNotification(req.body.io, {
        section: 'Ongoing FundMe',
        trigger: 'After voter voted in FundMe (non-Superfans)',
        fundme: updateFundme,
        voterId: userId,
        donuts: amount
      })
    } else {
      const transaction = new AdminUserTransaction({
        description: 5,
        from: "USER",
        to: "FUNDME",
        user: userId,
        fundme: fundmeId,
        donuts: amount,
        date: calcTime()
      })
      await transaction.save()

      addNewNotification(req.body.io, {
        section: 'Ongoing FundMe',
        trigger: 'After voter voted in FundMe (Superfans)',
        fundme: updateFundme,
        voterId: userId,
        donuts: amount
      })
    }

    return res.status(200).json({ success: true, payload: { fundme: fundmePayload, user: payload } })
  } catch (err) {
    console.log(err);
  }
}

////////////////////////////////////////////////////////////////////////////////

export const getDraftFundme = (req: Request, res: Response) => {
  const { userId } = req.body;
  FundMe.findOne({ owner: userId, published: false })
    .then((fundme: any) => {
      if (fundme) {
        res.status(200).json({ isDraft: true, fundme: fundme });
      } else res.status(200).json({ isDraft: false });
    }).catch((err: any) => console.log(err));
}

export const saveFundme = async (req: Request, res: Response) => {
  try {
    const { fundme, userId } = req.body;
    fundme.owner = userId;
    const resFundme: any = await FundMe.findOne({ owner: userId, published: false });
    if (resFundme) {
      if (resFundme.teaser && resFundme.teaser !== fundme.teaser) {
        const filePath = "public/" + resFundme.teaser;
        fs.unlink(filePath, (err) => {
          if (err) throw err;
        });
      }
      if (resFundme.cover && resFundme.cover !== fundme.cover) {
        const filePath = "public/" + resFundme.cover;
        fs.unlink(filePath, (err) => {
          if (err) throw err;
        });
      }
      const updatedFundme: any = await FundMe.findByIdAndUpdate(resFundme._id, {
        title: fundme.title,
        teaser: fundme.teaser,
        cover: fundme.cover,
        deadline: fundme.deadline,
        category: fundme.category,
        reward: fundme.reward,
        rewardText: fundme.rewardText,
        goal: fundme.goal,
        sizeType: fundme.sizeType,
        coverIndex: fundme.coverIndex
      }, { new: true });
      const resultFundme: any = await FundMe.findById(updatedFundme._id);
      if (resultFundme) res.status(200).json({ success: true, fundme: resultFundme });
    } else {
      fundme.published = false;
      const newFundme = new FundMe(fundme);
      const resNewFundme = await newFundme.save();

      const resultFundme: any = await FundMe.findById(resNewFundme._id);
      if (resultFundme) res.status(200).json({ success: true, fundme: resultFundme });
    }
  } catch (err: any) {
    console.log(err);
  }
}

export const deleteFundme = async (req: Request, res: Response) => {
  try {
    const { fundmeId } = req.params;
    const fundme: any = await FundMe.findById(fundmeId);
    if (fundme.teaser) {
      const filePath = "public/" + fundme.teaser;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      })
    }
    if (fundme.cover) {
      const filePath = "public/" + fundme.cover;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    await FundMe.findByIdAndDelete(fundmeId);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export const publishFundme = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const fundme: any = await FundMe.findOne({ owner: userId, published: false })
    const updatedFundme: any = await FundMe.findByIdAndUpdate(fundme._id, { published: true, date: calcTime() }, { new: true });

    addNewNotification(req.body.io, {
      section: 'Create FundMe',
      trigger: 'After created a FundMe',
      fundme: updatedFundme,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err)
  }
}

export const checkFundMeFinished = async (req: Request, res: Response) => {
  try {
    const { fundmeId } = req.params;
    const fundme: any = await FundMe.findById(fundmeId);
    return res.status(200).json({ finished: fundme.finished });
  } catch (err) {
    console.log(err);
  }
}

export const getFundMeDetails = async (req: Request, res: Response) => {
  try {
    const { fundmeId } = req.params
    const fundme: any = await FundMe.findById(fundmeId).populate([{ path: 'owner' }, { path: 'voteInfo.voter' }])
    const result = {
      ...fundme._doc,
      time: Math.round((new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / 1000),
    }
    return res.status(200).json({ success: true, payload: { fundme: result } })
  } catch (err) { console.log(err) }
}

export const checkOngoingfundmes = async (io: any) => {
  try {
    const fundmes: any = await FundMe.find({ published: true }).where('finished').equals(false);
    for (const fundme of fundmes) {
      if ((new Date(fundme.date).getTime() + 1000 * 3600 * 24 * fundme.deadline) < new Date(calcTime()).getTime()) {
        await FundMe.findByIdAndUpdate(fundme._id, { finished: true }, { new: true })
        await User.findByIdAndUpdate(fundme.owner, { tipFunction: true })
      }
    }
  } catch (err: any) {
    console.log(err);
  }
}

export const getFundmeResult = async (req: Request, res: Response) => {
  try {
    const { fundmeId } = req.params;
    const fundme: any = await FundMe.findById(fundmeId).populate([{ path: 'owner' }, { path: 'voteInfo.voter' }])
    if (fundme) {
      const fanwall: any = await Fanwall.findOne({ fundme: fundme._id })
      const result = {
        ...fundme._doc,
        fanwall: fanwall,
        time: Math.round((new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / 1000),
      }
      return res.status(200).json({ success: true, fundme: result, fanwall: fanwall })
    }
  } catch (err) { console.log(err) }
}

export const getFundMeList = async (req: Request, res: Response) => {
  try {
    const { search } = req.body;
    if (search === "") {
      const fundmes: any = await FundMe.find({ 'published': true }).populate({ path: 'owner', select: { 'name': 1, 'categories': 1 } })
      var result: Array<object> = [];
      for (const fundme of fundmes) {
        let time = 0.0;
        if (!fundme.finished) time = (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 3600 * 24 * fundme.deadline * 1000) / (1000 * 24 * 3600);
        result.push({
          id: fundme._id,
          date: fundme.date,
          time: time,
          finished: fundme.finished,
          owner: fundme.owner,
          category: fundme.category,
          title: fundme.title,
          wallet: fundme.wallet,
          show: fundme.show,
          empty: fundme.empty
        });
      }
      return res.status(200).json({ success: true, fundmes: result });
    }
  } catch (err) {
    console.log(err);
  }
}

export const setFundMeShow = async (req: Request, res: Response) => {
  try {
    const { fundmeId } = req.params;
    const { show } = req.body;
    const updatedFundme: any = await FundMe.findByIdAndUpdate(fundmeId, { show: show }, { new: true });
    if (updatedFundme) return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export const deleteFundMe = async (req: Request, res: Response) => {
  try {
    const { fundmeId } = req.params;
    const result = await Promise.all([
      FundMe.findById(fundmeId),
      Fanwall.findOne({ fundme: fundmeId })
    ])
    const fundme: any = result[0]
    const fanwall: any = result[1]
    if (fundme.teaser) {
      const filePath = "public/" + fundme.teaser;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    if (fundme.cover) {
      const filePath = "public/" + fundme.cover;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    let delFuncs: Array<any> = []
    if (fanwall) delFuncs.push(Fanwall.findByIdAndDelete(fanwall._id))
    delFuncs.push(FundMe.findByIdAndDelete(fundmeId))
    await Promise.all(delFuncs)
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export const updateFundMe = async (req: Request, res: Response) => {
  try {
    const { fundmeId } = req.params;
    const { fundme } = req.body;
    const resFundme: any = await FundMe.findById(fundmeId);
    if (fundme.teaserFile) {
      const filePath = "public/" + resFundme.teaser;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    if (fundme.coverFile && resFundme.cover) {
      const filePath = "public/" + resFundme.cover;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    await FundMe.findByIdAndUpdate(fundmeId, {
      title: fundme.title,
      category: fundme.category,
      teaser: fundme.teaserFile ? fundme.teaserFile : resFundme.teaser,
      cover: fundme.coverFile ? fundme.coverFile : resFundme.cover,
      sizeType: fundme.sizeType ? fundme.sizeType : resFundme.sizeType
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}