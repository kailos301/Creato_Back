import { Request, Response } from "express"
import path from "path"
import multer from "multer"
import fs from "fs"
import DareMe from "../models/DareMe"
import User from "../models/User"
import Option from "../models/Option"
import Fanwall from "../models/Fanwall"
import AdminUserTransaction from "../models/AdminUserTransaction"
import FundMe from "../models/FundMe"
import { addNewNotification } from '../controllers/notificationController'

function calcTime() {
  var d = new Date()
  var utc = d.getTime()
  var nd = new Date(utc + (3600000 * 8))
  return nd
}

/////////////////////////// CLEAN /////////////////////////////

export const checkOngoingdaremes = async (io: any) => {
  try {
    const daremes: any = await DareMe.find({ published: true }).where('finished').equals(false).populate({ path: 'options.option' })

    for (const dareme of daremes) {
      if ((new Date(dareme.date).getTime() + 1000 * 3600 * 24 * dareme.deadline) < new Date(calcTime()).getTime()) { //// dareme is finished?
        await User.findByIdAndUpdate(dareme.owner, { tipFunction: true })
        await DareMe.findByIdAndUpdate(dareme._id, { finished: true })

        const refundOptions = dareme.options.filter((option: any) => option.option.status === 0)
        for (const option of refundOptions) {
          const user: any = await User.findById(option.option.writer)
          io.to(user.email).emit("wallet_change", user.wallet + option.option.donuts)
          const transaction = new AdminUserTransaction({
            description: 7,
            from: "DAREME",
            to: "USER",
            user: user._id,
            dareme: dareme._id,
            donuts: option.option.donuts,
            date: calcTime(),
            title: dareme.title
          })

          Promise.all([
            Option.findByIdAndUpdate(option.option._id, { status: -1 }),
            transaction.save(),
            DareMe.findByIdAndUpdate(dareme._id, { wallet: dareme.wallet - option.option.donuts }),
            User.findByIdAndUpdate(user._id, { wallet: user.wallet + option.option.donuts })
          ])
        }

        const options = dareme.options.filter((option: any) => option.option.status === 1) // accpeted options
        const maxOption: any = options.reduce(
          (prev: any, current: any) =>
            (prev.option.donuts > current.option.donuts) ? prev
              : (prev.option.donuts === current.option.donuts && prev.option.voters > current.option.voters) ? prev : current) /// top donuts options
        const filters = options.filter((option: any) => option.option.donuts === maxOption.option.donuts && option.option.voters === maxOption.option.voters) /// get count of top donuts options

        if (filters.length) { /// if more than 2 top options

          await Option.findByIdAndUpdate(filters[0].option._id, { win: true }) // win option
          const noWinOptions = options.filter((option: any) => (option.option._id + "") !== (filters[0].option._id + "")) /// non-win options
          let votes: Array<any> = []

          for (const option of noWinOptions) {
            for (const vote of option.option.voteInfo) {
              ///////////////// Users who didn't win in dareme /////////////////////
              const filters1 = votes.filter(vot => (vot.userId + '') === (vote.voter + ''))

              if (filters1.length) {
                let foundIndex = votes.findIndex(vot => (vot.userId + '') === (vote.voter + ''))
                let item = {
                  userId: filters1[0].userId,
                  donuts: filters1[0].donuts + vote.donuts
                }
                votes[foundIndex] = item
              } else {
                votes.push({
                  userId: vote.voter,
                  donuts: vote.donuts
                })
              }
            }
          }

          ///////////////// Notification Part /////////////////////

          addNewNotification(io, {
            section: 'Finished DareMe',
            trigger: 'After DareMe is finished',
            dareme: dareme,
            option: maxOption,
            voters: votes
          })
        }
      }
    }
  } catch (err: any) {
    console.log(err);
  }
}

export const dareCreator = async (req: Request, res: Response) => {
  const { daremeId, title, amount, userId } = req.body; //get params : userId=session,daremeId:
  const newOption = new Option({
    title: title,
    writer: userId,
    status: 0,
    donuts: amount,
    voters: 0,
    requests: amount
  })

  const results = await Promise.all([
    newOption.save(),
    User.findById(userId),
    DareMe.findById(daremeId)
  ])

  const option: any = results[0]
  const user: any = results[1] // sender who is called this api
  const dareme: any = results[2]

  let daremeWallet = dareme.wallet + amount
  let options = dareme.options
  let wallet = user.wallet - amount
  options.push({ option: option._id })

  req.body.io.to(user.email).emit("wallet_change", wallet)
  const transaction = new AdminUserTransaction({
    description: 6, // request dare
    from: "USER",
    to: "DAREME",
    user: userId,
    dareme: daremeId,
    donuts: amount,
    date: calcTime()
  })

  const results1: any = await Promise.all([
    DareMe.findByIdAndUpdate(dareme._id, { options: options, wallet: daremeWallet }, { new: true }).populate([{ path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }]),
    User.findByIdAndUpdate(user._id, { wallet: wallet }),
    transaction.save()
  ])

  let donuts = 0
  results1[0].options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })
  const updatedDareme = {
    ...results1[0]._doc,
    donuts: donuts,
    time: Math.round((new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / 1000)
  }

  return res.status(200).json({ success: true, payload: { dareme: updatedDareme, optionId: option._id } })
}

export const acceptDareOption = async (req: Request, res: Response) => {
  try {
    const { optionId, daremeId } = req.body
    const result = await Promise.all([
      DareMe.findById(daremeId),
      Option.findById(optionId)
    ])

    const dareme: any = result[0]
    const option: any = result[1]
    let daremeVoteInfo = [...dareme.voteInfo]
    let voterFilter = dareme.voteInfo.filter((vote: any) => (vote.voter + '') === (option.writer + ''))
    if (voterFilter.length === 0) daremeVoteInfo.push({ voter: option.writer, superfan: true, donuts: option.requests })
    else {
      const foundIndex = daremeVoteInfo.findIndex((vote: any) => (vote.voter + "") === (option.writer + ""))
      daremeVoteInfo[foundIndex].donuts += option.requests
      if (daremeVoteInfo[foundIndex].superfan === false) daremeVoteInfo[foundIndex].superfan = option.requests >= dareme.reward ? true : false
    }

    const results: any = await Promise.all([
      Option.findByIdAndUpdate(optionId, { status: 1 }, { new: true }),
      DareMe.findByIdAndUpdate(daremeId, { voteInfo: daremeVoteInfo }, { new: true }).populate([{ path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }])
    ])

    let donuts = 0
    results[1].options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })

    const resDareme = {
      ...results[1]._doc,
      donuts: donuts,
      time: Math.round((new Date(results[1].date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * results[1].deadline + 1000 * 60) / 1000)
    }
    return res.status(200).json({ success: true, payload: { dareme: resDareme } })
  } catch (err) { console.log(err) }
}

export const declineDareOption = async (req: Request, res: Response) => {
  try {
    const { optionId, daremeId } = req.body
    const results = await Promise.all([
      Option.findByIdAndUpdate(optionId, { status: -1 }, { new: true }).populate({ path: 'writer' }),
      DareMe.findById(daremeId)
    ])

    const option: any = results[0]
    const dareme: any = results[1]
    const user: any = await User.findById(option.writer._id)

    req.body.io.to(user.email).emit("wallet_change", user.wallet + option.donuts)
    const transaction = new AdminUserTransaction({
      description: 7, // declien dare request
      from: "DAREME",
      to: "USER",
      user: user._id,
      dareme: daremeId,
      donuts: option.donuts,
      date: calcTime()
    })

    const results1: any = await Promise.all([
      User.findByIdAndUpdate(user._id, { wallet: user.wallet + option.donuts }),
      DareMe.findByIdAndUpdate(daremeId, { wallet: dareme.wallet - option.donuts }, { new: true }).populate([{ path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }]),
      transaction.save()
    ])

    let donuts = 0
    results1[1].options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })

    const resDareme = {
      ...results1[1]._doc,
      donuts: donuts,
      time: Math.round((new Date(results1[1].date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * results1[1].deadline + 1000 * 60) / 1000)
    }

    return res.status(200).json({ success: true, payload: { dareme: resDareme } })
  } catch (err) {
    console.log(err)
  }
}

export const getDareMeDetails = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params
    const dareme: any = await DareMe.findById(daremeId).populate([{ path: 'voteInfo.voter' }, { path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }])

    let donuts = 0
    dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })

    const result = {
      ...dareme._doc,
      donuts: donuts,
      time: Math.round((new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / 1000)
    }
    return res.status(200).json({
      success: true,
      payload: { dareme: result }
    })
  } catch (err) { console.log(err) }
}

export const supportCreator = async (req: Request, res: Response) => {
  try {
    const { userId, daremeId, optionId, amount } = req.body
    const result = await Promise.all([
      Option.findById(optionId),
      DareMe.findById(daremeId).populate({ path: 'owner' }),
      User.findById(userId)
    ])

    const option: any = result[0]
    const dareme: any = result[1]
    const user: any = result[2]

    let voteInfo = option.voteInfo
    let totalDonuts = option.donuts + amount
    let totalVoters = option.voters
    let daremeVoteInfo = [...dareme.voteInfo]
    let voterFilter = daremeVoteInfo.filter((vote: any) => (vote.voter + '') === (userId + ''))
    if (voterFilter.length === 0) daremeVoteInfo.push({ voter: userId, superfan: amount >= dareme.reward ? true : false, donuts: amount })
    else {
      const foundIndex = daremeVoteInfo.findIndex((vote: any) => (vote.voter + "") === (userId + ""))
      daremeVoteInfo[foundIndex].donuts += amount
      if (daremeVoteInfo[foundIndex].superfan === false) daremeVoteInfo[foundIndex].superfan = amount >= dareme.reward ? true : false
    }

    let filters = voteInfo.filter((option: any) => (option.voter + "") === (userId + ""));
    if (filters.length) {
      voteInfo = voteInfo.map((option: any) => {
        if ((option.voter + "") === (userId + "")) {
          option.donuts = option.donuts + amount
          if (amount >= dareme.reward) option.superfan = true
        }
        return option
      })
    } else {
      totalVoters = totalVoters + 1
      voteInfo.push({
        voter: userId,
        donuts: amount,
        superfan: amount >= dareme.reward ? true : false
      })
    }
    const daremeWallet = dareme.wallet + amount

    await Option.findByIdAndUpdate(option._id, { donuts: totalDonuts, voters: totalVoters, voteInfo: voteInfo }, { new: true }).populate({ path: 'writer' })
    const updatedDareme: any = await DareMe.findByIdAndUpdate(daremeId, { wallet: daremeWallet, voteInfo: daremeVoteInfo }, { new: true }).populate([{ path: 'voteInfo.voter' }, { path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }])

    let donuts = 0
    updatedDareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })
    const resDareme = {
      ...updatedDareme._doc,
      donuts: donuts,
      time: Math.round((new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / 1000)
    }

    let wallet = user.wallet - amount
    const updatedUser: any = await User.findByIdAndUpdate(userId, { wallet: wallet }, { new: true })
    const resUser = { ...updatedUser._doc, id: updatedUser._id }

    req.body.io.to(updatedUser.email).emit("wallet_change", updatedUser.wallet)

    if (amount < dareme.reward) {
      const transaction = new AdminUserTransaction({
        description: 11,
        from: "USER",
        to: "DAREME",
        user: userId,
        dareme: daremeId,
        donuts: amount,
        date: calcTime()
      })

      await transaction.save()
      addNewNotification(req.body.io, {
        section: 'Ongoing DareMe',
        trigger: 'After voter voted in DareMe (non-Superfans)',
        dareme: updatedDareme,
        option: option,
        voterId: userId,
        donuts: amount
      })
    } else {
      const transaction = new AdminUserTransaction({
        description: 5,
        from: "USER",
        to: "DAREME",
        user: userId,
        dareme: daremeId,
        donuts: amount,
        date: calcTime()
      })
      await transaction.save()

      addNewNotification(req.body.io, {
        section: 'Ongoing DareMe',
        trigger: 'After voter voted in DareMe (Superfans)',
        dareme: updatedDareme,
        option: option,
        voterId: userId,
        donuts: amount
      })
    }
    return res.status(200).json({ success: true, payload: { dareme: resDareme, user: resUser } })
  } catch (err) { console.log(err) }
}

export const getDaremeVoters = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params
    const dareme: any = await DareMe.findById(daremeId).populate([{ path: 'owner' }, { path: 'options.option', populate: [{ path: 'writer' }, { path: 'voteInfo.voter' }] }])
    const { options } = dareme
    let resOptions: Array<any> = []

    options.forEach((option: any) => {
      if (option.option.requests) {
        let optionTemp = option
        let votes: Array<any> = []
        let writerIsVoter = false
        option.option.voteInfo.forEach((vote: any) => {
          if ((option.option.writer._id + '') === (vote.voter._id + '')) {
            writerIsVoter = true
            let voteTemp = vote
            voteTemp.donuts += option.option.requests ? option.option.requests : 0
            votes.push(voteTemp)
          } else votes.push(vote)
        })
        if (writerIsVoter === false) votes.push({ voter: option.option.writer, donuts: option.option.requests })
        optionTemp.option.voteInfo = votes
        resOptions.push(optionTemp)
      } else resOptions.push(option)
    })

    let donuts = 0
    dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })
    const resDareme = {
      ...dareme._doc,
      donuts: donuts,
      options: resOptions,
      time: Math.round((new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / 1000)
    }

    return res.status(200).json({ success: true, payload: { dareme: resDareme } })
  } catch (err) {
    console.log(err)
  }
}

export const checkRefundPossible = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params
    const { userId } = req.body
    const dareme: any = await DareMe.findById(daremeId).populate({ path: 'options.option' })
    if (dareme.fanwall) return res.status(200).json({ success: true, refund: false })

    let refund = true
    const filters = dareme.voteInfo.filter((vote: any) => (vote.voter + "") === (userId + ""))
    if (filters[0].transfer === true) refund = false
    else refund = true

    return res.status(200).json({ success: true, refund: refund })
  } catch (err) {
    console.log(err)
  }
}

export const refundDonuts = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params
    const { donuts, userId, io } = req.body

    const results = await Promise.all([
      User.findById(userId),
      DareMe.findById(daremeId)
    ])

    const user: any = results[0]
    const dareme: any = results[1]
    const userWallet = user.wallet + donuts
    const voteInfo = dareme.voteInfo

    const index = dareme.voteInfo.findIndex((vote: any) => (vote.voter + "") === (userId + ""))
    voteInfo[index].transfer = true

    const transaction = new AdminUserTransaction({
      description: 7,
      from: "DAREME",
      to: "USER",
      user: userId,
      dareme: daremeId,
      donuts: donuts,
      date: calcTime()
    });

    const results1 = await Promise.all([
      transaction.save(),
      DareMe.findByIdAndUpdate(daremeId, { wallet: dareme.wallet - donuts, voteInfo: voteInfo }),
      User.findByIdAndUpdate(userId, { wallet: userWallet }, { new: true })
    ])

    io.to(user.email).emit('wallet_change', userWallet)
    const updatedUser: any = results1[2]

    const payload = {
      id: updatedUser._id,
      name: updatedUser.name,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      email: updatedUser.email,
      wallet: updatedUser.wallet,
      personalisedUrl: updatedUser.personalisedUrl,
      language: updatedUser.language,
      category: updatedUser.categories,
      new_notification: updatedUser.new_notification,
    };

    return res.status(200).json({ success: true, user: payload })
  } catch (err) {
    console.log(err)
  }
}

export const supportRefund = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params
    const { userId } = req.body

    const dareme: any = await DareMe.findById(daremeId)
    const voteInfo = dareme.voteInfo

    const index = dareme.voteInfo.findIndex((vote: any) => (vote.voter + "") === (userId + ""))
    voteInfo[index].transfer = true

    await DareMe.findByIdAndUpdate(daremeId, { voteInfo: voteInfo })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.log(err)
  }
}

export const getDaremeResult = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params;
    const dareme: any = await DareMe.findById(daremeId).populate([{ path: 'voteInfo.voter' }, { path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }])
    if (dareme) {
      const fanwall = await Fanwall.findOne({ dareme: dareme._id })
      const options = dareme.options.filter((option: any) => option.option.status === 1)
      dareme.options = options
      let donuts = 0
      dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })
      const result = {
        ...dareme._doc,
        donuts: donuts,
        fanwall: fanwall,
        time: Math.round((new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline) / 1000),
      }
      return res.status(200).json({ success: true, payload: { dareme: result, fanwall: fanwall } })
    }
  } catch (err) { console.log(err) }
}

///////////////////////////////////////////////////////////////////////////////

export const publishDareme = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const dareme: any = await DareMe.findOne({ owner: userId, published: false })
    const updatedDareme = await DareMe.findByIdAndUpdate(dareme._id, { published: true, date: calcTime() }, { new: true });

    addNewNotification(req.body.io, {
      section: 'Create DareMe',
      trigger: 'After created a DareMe',
      dareme: updatedDareme,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err)
  }
}

export const getDraftDareme = (req: Request, res: Response) => {
  const { userId } = req.body;
  DareMe.findOne({ owner: userId, published: false })
    .populate({ path: 'options.option' })
    .then((dareme: any) => {
      if (dareme) {
        res.status(200).json({ isDraft: true, dareme: dareme });
      } else res.status(200).json({ isDraft: false });
    }).catch((err: any) => console.log(err));
}

export const saveDareme = async (req: Request, res: Response) => {
  try {
    const { dareme, userId } = req.body;
    dareme.owner = userId;
    const resDareme: any = await DareMe.findOne({ owner: userId, published: false });
    if (resDareme) {
      if (resDareme.teaser && resDareme.teaser !== dareme.teaser) {
        const filePath = "public/" + resDareme.teaser;
        fs.unlink(filePath, (err) => {
          if (err) throw err;
        });
      }
      if (resDareme.cover && resDareme.cover !== dareme.cover) {
        const filePath = "public/" + resDareme.cover;
        fs.unlink(filePath, (err) => {
          if (err) throw err;
        });
      }
      if (resDareme.options.length && resDareme.options[0].option._id !== null) {
        await Promise.all([
          Option.findByIdAndUpdate(resDareme.options[0].option._id, { title: dareme.options[0].option.title }),
          Option.findByIdAndUpdate(resDareme.options[1].option._id, { title: dareme.options[1].option.title })
        ]);
      } else {
        let newOptions: Array<any> = [];
        if (dareme.options.length) {
          const tempOption1 = new Option({
            writer: userId,
            title: dareme.options[0].option.title,
            status: 1
          });
          const tempOption2 = new Option({
            writer: userId,
            title: dareme.options[1].option.title,
            status: 1
          });
          const resOptions = await Promise.all([tempOption1.save(), tempOption2.save()])
          newOptions.push({ option: resOptions[0]._id });
          newOptions.push({ option: resOptions[1]._id });
        }
        dareme.options = newOptions;
      }
      const updatedDareme: any = await DareMe.findByIdAndUpdate(resDareme._id, {
        title: dareme.title,
        teaser: dareme.teaser,
        cover: dareme.cover,
        deadline: dareme.deadline,
        category: dareme.category,
        options: dareme.options,
        sizeType: dareme.sizeType,
        coverIndex: dareme.coverIndex,
        reward: dareme.reward,
        rewardText: dareme.rewardText
      }, { new: true });
      const resultDareme = await DareMe.findById(updatedDareme._id).populate({ path: 'options.option' });
      if (resultDareme) res.status(200).json({ success: true, dareme: resultDareme });
    } else {
      let newOptions: Array<any> = [];
      if (dareme.options.length) {
        const tempOption1 = new Option({
          writer: userId,
          title: dareme.options[0].option.title,
          status: 1
        });
        const tempOption2 = new Option({
          writer: userId,
          title: dareme.options[1].option.title,
          status: 1
        });
        const resOptions = await Promise.all([tempOption1.save(), tempOption2.save()])
        newOptions.push({ option: resOptions[0]._id });
        newOptions.push({ option: resOptions[1]._id });
      }
      dareme.options = newOptions;
      dareme.published = false;
      const newDareme = new DareMe(dareme);
      const resNewDareme = await newDareme.save();
      const resultDareme = await DareMe.findById(resNewDareme._id).populate({ path: 'options.option' });
      if (resultDareme) res.status(200).json({ success: true, dareme: resultDareme });
    }
  } catch (err: any) {
    console.log(err);
  }
}

const coverStorage = multer.diskStorage({
  destination: "./public/uploads/cover/",
  filename: function (req, file, cb) {
    cb(null, "Cover-" + Date.now() + path.extname(file.originalname));
  }
});

const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 30 * 1024 * 1024 },
}).single("file");

export const selectCover = (req: Request, res: Response) => {
  uploadCover(req, res, () => {
    res.status(200).json({ success: true, path: "uploads/cover/" + req.file?.filename });
  });
}

const teaserStorage = multer.diskStorage({
  destination: "./public/uploads/teaser/",
  filename: function (req, file, cb) {
    cb(null, "Teaser-" + Date.now() + path.extname(file.originalname));
  }
});

const uploadTeaser = multer({
  storage: teaserStorage,
  limits: { fileSize: 30 * 1024 * 1024 },
}).single("file");

export const uploadFile = (req: Request, res: Response) => {
  uploadTeaser(req, res, () => {
    res.status(200).json({ success: true, path: "uploads/teaser/" + req.file?.filename });
  });
}

export const checkDareMeFinished = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params;
    const dareme: any = await DareMe.findById(daremeId);
    return res.status(200).json({ finished: dareme.finished });
  } catch (err) {
    console.log(err);
  }
}

export const deleteDareme = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params
    const result = await Promise.all([
      DareMe.findById(daremeId),
      Fanwall.findOne({ dareme: daremeId })
    ])
    const dareme: any = result[0]
    const fanwall: any = result[1]
    const options = dareme.options
    const delFuncs: Array<any> = []
    if (fanwall) delFuncs.push(Fanwall.findByIdAndDelete(fanwall._id))
    for (const option of options) delFuncs.push(Option.findByIdAndDelete(option.option))
    if (dareme.teaser) {
      const filePath = "public/" + dareme.teaser;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    if (dareme.cover) {
      const filePath = "public/" + dareme.cover;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }

    delFuncs.push(DareMe.findByIdAndDelete(daremeId))
    await Promise.all(delFuncs)
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export const getDaremesByPersonalUrl = async (req: Request, res: Response) => {
  try {
    const { url } = req.body
    const user: any = await User.findOne({ personalisedUrl: url })
    const result: any = await Promise.all([
      DareMe.find({ owner: user._id, published: true, show: true }).populate([{ path: 'owner' }, { path: 'options.option' }]),
      FundMe.find({ owner: user._id, published: true, show: true }).populate({ path: 'owner' }),
      DareMe.find({ published: true, show: true, "voteInfo.voter": user._id }).where('owner').ne(user._id).populate([{ path: 'owner' }, { path: 'options.option' }]),
      FundMe.find({ published: true, show: true, "voteInfo.voter": user._id }).where('owner').ne(user._id).populate({ path: 'owner' }),
      Fanwall.find({ writer: user._id, posted: true })
    ])

    const daremes = result[0]
    const fundmes = result[1]
    const fanwalls = result[4]

    let daremeItems = <Array<any>>[]
    let fundmeItems = <Array<any>>[]
    let ongoingItems = <Array<any>>[]
    let finishedItems = <Array<any>>[]
    let voters = 0

    for (const dareme of daremes) {
      const filters = dareme.voteInfo.filter((vote: any) => vote.superfan === true)
      voters += filters.length
      let donuts = 0
      dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })
      let item = {
        ...dareme._doc,
        donuts: donuts,
        isUser: true,
        time: Math.round((new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline) / 1000)
      }
      if (dareme.finished) finishedItems.push(item)
      else ongoingItems.push(item)
    }

    const newArrDm = ongoingItems.slice()
    for (let i = newArrDm.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrDm[i]
      newArrDm[i] = newArrDm[rand]
      newArrDm[rand] = temp
    }
    const newArrDm1 = finishedItems.slice()
    for (let i = newArrDm1.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrDm1[i]
      newArrDm1[i] = newArrDm1[rand]
      newArrDm1[rand] = temp
    }
    daremeItems = newArrDm.concat(newArrDm1)

    ongoingItems = []
    finishedItems = []
    for (const fundme of fundmes) {
      const filters = fundme.voteInfo.filter((vote: any) => vote.superfan === true)
      voters += filters.length
      let item = {
        ...fundme._doc,
        donuts: fundme.wallet,
        isUser: true,
        time: Math.round((new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / 1000)
      }
      if (fundme.finished) finishedItems.push(item)
      else ongoingItems.push(item)
    }

    const newArrFm = ongoingItems.slice()
    for (let i = newArrFm.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrFm[i]
      newArrFm[i] = newArrFm[rand]
      newArrFm[rand] = temp
    }
    const newArrFm1 = finishedItems.slice()
    for (let i = newArrFm1.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrFm1[i]
      newArrFm1[i] = newArrFm1[rand]
      newArrFm1[rand] = temp
    }
    fundmeItems = newArrFm.concat(newArrFm1)

    const daredDaremes = result[2]
    ongoingItems = []
    finishedItems = []
    for (const dareme of daredDaremes) {
      let donuts = 0
      dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })
      let item = {
        ...dareme._doc,
        donuts: donuts,
        isUser: false,
        time: Math.round((new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline) / 1000)
      }
      if (dareme.finished) finishedItems.push(item)
      else ongoingItems.push(item)
    }

    const newArrDaredDm = ongoingItems.slice()
    for (let i = newArrDaredDm.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrDaredDm[i]
      newArrDaredDm[i] = newArrDaredDm[rand]
      newArrDaredDm[rand] = temp
    }
    const newArrDaredDm1 = finishedItems.slice()
    for (let i = newArrDaredDm1.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrDaredDm1[i]
      newArrDaredDm1[i] = newArrDaredDm1[rand]
      newArrDaredDm1[rand] = temp
    }
    daremeItems = daremeItems.concat(newArrDaredDm)
    daremeItems = daremeItems.concat(newArrDaredDm1)

    const fundedFundmes = result[3]
    ongoingItems = []
    finishedItems = []
    for (const fundme of fundedFundmes) {
      let item = {
        ...fundme._doc,
        donuts: fundme.wallet,
        isUser: false,
        time: Math.round((new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / 1000)
      }
      if (fundme.finished) finishedItems.push(item)
      else ongoingItems.push(item)
    }

    const newArrDaredFm = ongoingItems.slice()
    for (let i = newArrDaredFm.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrDaredFm[i]
      newArrDaredFm[i] = newArrDaredFm[rand]
      newArrDaredFm[rand] = temp
    }
    const newArrDaredFm1 = finishedItems.slice()
    for (let i = newArrDaredFm1.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrDaredFm1[i]
      newArrDaredFm1[i] = newArrDaredFm1[rand]
      newArrDaredFm1[rand] = temp
    }
    fundmeItems = fundmeItems.concat(newArrDaredFm)
    fundmeItems = fundmeItems.concat(newArrDaredFm1)

    return res.status(200).json({
      success: true,
      payload: {
        daremes: daremeItems,
        fundmes: fundmeItems,
        user: {
          ...user._doc,
          superfans: voters,
          itemCnt: daremes.length + fundmes.length,
          fanwallCnt: fanwalls.length
        }
      }
    })
  } catch (err) { console.log(err) }
}

export const getDaremesOngoing = async (req: Request, res: Response) => {
  try {
    const daremeFunc: any = DareMe.find({ published: true, show: true }).populate([{ path: 'owner' }, { path: 'options.option' }])
    const fundmeFunc: any = FundMe.find({ published: true, show: true }).populate({ path: 'owner' })
    const fanwallFunc: any = Fanwall.find({ posted: true }).populate([
      { path: 'writer' },
      { path: 'dareme', populate: { path: 'options.option' } },
      { path: 'fundme' }
    ])
    const finishedDareme = DareMe.find({ finished: true }).populate({ path: 'owner' })
    const finishedFundme = FundMe.find({ finished: true }).populate({ path: 'owner' })

    const result: any = await Promise.all([daremeFunc, fundmeFunc, fanwallFunc, finishedDareme, finishedFundme])
    const daremes: any = result[0]
    const fundmes: any = result[1]
    const fanwalls: any = result[2]

    const users = <Array<any>>[]
    for (const dareme of result[3]) {
      const filters = users.filter((user: any) => (user._id + '') === (dareme.owner._id + ''))
      if (filters.length === 0 && dareme.owner.role === 'USER') users.push(dareme.owner)
    }
    for (const fundme of result[4]) {
      const filters = users.filter((user: any) => (user._id + '') === (fundme.owner._id + ''))
      if (filters.length === 0 && fundme.owner.role === 'USER') users.push(fundme.owner)
    }

    let daremeItems = <Array<any>>[]
    let fundmeItems = <Array<any>>[]
    let ongoingItems = <Array<any>>[]
    let finishedItems = <Array<any>>[]

    for (const dareme of daremes) {
      let donuts = 0
      dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })

      let item = {
        ...dareme._doc,
        donuts: donuts,
        time: Math.round((new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline) / 1000)
      }

      if (dareme.finished) finishedItems.push(item)
      else ongoingItems.push(item)
    }

    const newArrDm = ongoingItems.slice()
    for (let i = newArrDm.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrDm[i]
      newArrDm[i] = newArrDm[rand]
      newArrDm[rand] = temp
    }

    const newArrDm1 = finishedItems.slice()
    for (let i = newArrDm1.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrDm1[i]
      newArrDm1[i] = newArrDm1[rand]
      newArrDm1[rand] = temp
    }
    daremeItems = newArrDm.concat(newArrDm1)

    ongoingItems = []
    finishedItems = []
    for (const fundme of fundmes) {
      let item = {
        ...fundme._doc,
        donuts: fundme.wallet,
        time: Math.round((new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / 1000)
      }

      if (fundme.finished) finishedItems.push(item)
      else ongoingItems.push(item)
    }

    const newArrFm = ongoingItems.slice()
    for (let i = newArrFm.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrFm[i]
      newArrFm[i] = newArrFm[rand]
      newArrFm[rand] = temp
    }

    const newArrFm1 = finishedItems.slice()
    for (let i = newArrFm1.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrFm1[i]
      newArrFm1[i] = newArrFm1[rand]
      newArrFm1[rand] = temp
    }
    fundmeItems = newArrFm.concat(newArrFm1)

    let resFanwalls = <Array<any>>[]
    fanwalls.forEach((fanwall: any) => {
      let totalDonuts = 0
      if (fanwall.dareme) {
        fanwall.dareme.options.forEach((option: any) => { if (option.option.status === 1) totalDonuts += option.option.donuts })
        resFanwalls.push({
          ...fanwall._doc,
          dareme: null,
          item: {
            ...fanwall.dareme._doc,
            donuts: totalDonuts,
          }
        })
      } else {
        resFanwalls.push({
          ...fanwall._doc,
          fundme: null,
          item: { 
            ...fanwall.fundme._doc,
            donuts: fanwall.fundme.wallet
          }
        })
      }
    })

    const newArrUser = users.slice()
    for (let i = newArrUser.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrUser[i]
      newArrUser[i] = newArrUser[rand]
      newArrUser[rand] = temp
    }

    const newArrFan = resFanwalls.slice()
    for (let i = newArrFan.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1))
      const temp = newArrFan[i]
      newArrFan[i] = newArrFan[rand]
      newArrFan[rand] = temp
    }

    return res.status(200).json({
      success: true,
      payload: {
        daremes: daremeItems,
        fundmes: fundmeItems,
        fanwalls: newArrFan,
        users: newArrUser
      }
    })
  } catch (err) { console.log(err) }
}

export const getOptionsFromUserId = async (req: Request, res: Response) => {
  try {

  } catch (e) {
    console.log(e);
  }
}

export const getDareCreatorDetails = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params;
    const dareme = await DareMe.findById(daremeId).populate({ path: 'owner', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } }).select({ 'title': 1, 'teaser': 1, 'cover': 1, 'sizeType': 1 });
    return res.status(200).json({ success: true, dareme: dareme });
  } catch (err) {
    console.log(err);
  }
}

export const checkDareMeRequests = async (req: Request, res: Response) => {
  const { daremeId } = req.params;
  const dareme: any = await DareMe.findById(daremeId);
  const options = dareme.options.filter((option: any) => option.option.status !== 1);
  return res.status(200).json({ request: options.length > 0 ? true : false });
}

export const getDareMeRequests = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params;
    const dareme: any = await DareMe.findById(daremeId).populate([{ path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }])
    const options = dareme.options.filter((option: any) => option.option.status !== 1)
      .sort((first: any, second: any) =>
        first.option.status > second.option.status ? -1 :
          first.option.status < second.option.status ? 1 :
            first.option.date > second.option.date ? 1 :
              first.option.date < second.option.date ? -1 : 0)
    let donuts = 0
    dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts })
    const result = {
      ...dareme._doc,
      donuts: donuts,
      options: options,
      time: Math.round((new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / 1000),
    }
    return res.status(200).json({ success: true, payload: { dareme: result } })
  } catch (err) {
    console.log(err)
  }
}

export const winDareOption = async (req: Request, res: Response) => {
  try {
    const { optionId, daremeId } = req.body;
    await Option.findByIdAndUpdate(optionId, { win: true });
    const dareme: any = await DareMe.findById(daremeId).populate({ path: 'options.option', model: Option });
    const options = dareme.options;
    const filters = options.filter((option: any) => option.option.win === false);
    let minusDonuts = 0;
    for (const option of filters) {
      for (const vote of option.option.voteInfo) {
        if ((option.option.writer + "") !== (vote.voter + "")) {
          const voter: any = await User.findById(vote.voter);
          let wallet = voter.wallet + vote.donuts;
          await User.findByIdAndUpdate(vote.voter, { wallet: wallet });
          req.body.io.to(voter.email).emit("wallet_change", wallet);
          const transaction = new AdminUserTransaction({
            description: 7,
            from: "DAREME",
            to: "USER",
            user: vote.voter,
            dareme: daremeId,
            donuts: vote.donuts,
            date: calcTime()
          });
          await transaction.save();
          minusDonuts += vote.donuts;
        }
      }
    }
    await DareMe.findByIdAndUpdate(daremeId, { wallet: dareme.wallet - minusDonuts });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export const getDareMeList = async (req: Request, res: Response) => {
  try {
    const { search } = req.body;
    if (search === "") {
      const daremes: any = await DareMe.find({ 'published': true })
        .populate({ path: 'owner', select: { 'name': 1, 'categories': 1 } })
        .select({ 'title': 1, 'category': 1, 'date': 1, 'deadline': 1, 'finished': 1, 'owner': 1, 'show': 1, 'wallet': 1 });
      var result: Array<object> = [];
      for (const dareme of daremes) {
        let time = 0.0;
        if (!dareme.finished) time = (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 3600 * 24 * dareme.deadline * 1000) / (1000 * 24 * 3600);
        result.push({
          id: dareme._id,
          date: dareme.date,
          time: time,
          finished: dareme.finished,
          owner: dareme.owner,
          category: dareme.category,
          title: dareme.title,
          wallet: dareme.wallet,
          show: dareme.show
        });
      }
      return res.status(200).json({ success: true, daremes: result });
    }
  } catch (err) {
    console.log(err);
  }
}

export const setDareMeShow = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params;
    const { show } = req.body;
    const updatedDareme = await DareMe.findByIdAndUpdate(daremeId, { show: show }, { new: true });
    if (updatedDareme) return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export const updateDareMe = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params;
    const { dareme } = req.body;
    const resDareme: any = await DareMe.findById(daremeId);
    if (dareme.teaserFile) {
      const filePath = "public/" + resDareme.teaser;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    if (dareme.coverFile && resDareme.cover) {
      const filePath = "public/" + resDareme.cover;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    let funcs = []
    if (dareme.options) {
      funcs.push(Option.findByIdAndUpdate(dareme.options[0].option._id, { title: dareme.options[0].option.title }))
      funcs.push(Option.findByIdAndUpdate(dareme.options[1].option._id, { title: dareme.options[1].option.title }))
    }

    funcs.push(
      DareMe.findByIdAndUpdate(daremeId, {
        title: dareme.title,
        category: dareme.category,
        teaser: dareme.teaserFile ? dareme.teaserFile : resDareme.teaser,
        cover: dareme.coverFile ? dareme.coverFile : resDareme.cover,
        sizeType: dareme.sizeType ? dareme.sizeType : resDareme.sizeType
      })
    )
    await Promise.all(funcs)
    return res.status(200).json({ success: true })
  } catch (err) {
    console.log(err);
  }
}

export const deleteOption = async (req: Request, res: Response) => {
  try {
    const { daremeId, optionId } = req.params;
    await Option.findByIdAndDelete(optionId);
    const dareme: any = await DareMe.findById(daremeId);
    const options = dareme.options.filter((option: any) => (option.option + "") !== (optionId + ""));
    await DareMe.findByIdAndUpdate(daremeId, { options: options });
    const resDareme = await DareMe.findById(daremeId)
      .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 1 } })
      .populate({
        path: 'options.option',
        model: Option,
        populate: { path: 'writer', select: { '_id': 0, 'name': 1 } },
        select: { '__v': 0, 'win': 0 },
      }).select({ 'published': 0, 'wallet': 0, '__v': 0 });
    return res.status(200).json({ success: true, dareme: resDareme });
  } catch (err) {
    console.log(err);
  }
}