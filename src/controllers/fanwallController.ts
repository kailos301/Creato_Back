import { Request, Response } from 'express';
import path from "path";
import multer from "multer";
import fs from "fs";
import Fanwall from "../models/Fanwall";
import DareMe from "../models/DareMe";
import FundMe from "../models/FundMe";
import Option from "../models/Option";
import User from "../models/User";
import Tip from "../models/Tip";
import AdminWallet from "../models/AdminWallet";
import AdminUserTransaction from '../models/AdminUserTransaction';

function calcTime() {
  var d = new Date();
  var utc = d.getTime();
  var nd = new Date(utc + (3600000 * 8));
  return nd;
}

/////////////////////// FANWALL //////////////////////////////////

export const getFanwallList = async (req: Request, res: Response) => {
  try {
    const result = await Promise.all([
      DareMe.find({ finished: true }).populate({ path: 'owner' }),
      FundMe.find({ finished: true }).populate({ path: 'owner' })
    ])

    const daremes: any = result[0]
    const fundmes: any = result[1]
    let daremeFuncs = <Array<any>>[]
    let fundmeFuncs = <Array<any>>[]

    for (const dareme of daremes) { daremeFuncs.push(Fanwall.findOne({ dareme: dareme._id })) }
    for (const fundme of fundmes) { fundmeFuncs.push(Fanwall.findOne({ fundme: fundme._id })) }
    const result1 = await Promise.all(daremeFuncs)
    const result2 = await Promise.all(fundmeFuncs)
    let fanwalls: Array<any> = []

    let index = 0
    for (const dareme of daremes) {
      const fanwall = result1[index]
      fanwalls.push({
        itemId: dareme._id,
        owner: dareme.owner,
        fanwall: (fanwall && fanwall.posted) ? fanwall : null,
        title: dareme.title,
        category: dareme.category,
        date: dareme.date,
        type: 'DareMe'
      })
      index++
    }

    index = 0
    for (const fundme of fundmes) {
      const fanwall = result2[index]
      fanwalls.push({
        itemId: fundme._id,
        owner: fundme.owner,
        fanwall: (fanwall && fanwall.posted) ? fanwall : null,
        title: fundme.title,
        category: fundme.category,
        date: fundme.date,
        type: 'FundMe'
      })
      index++
    }

    fanwalls = fanwalls.sort((first: any, second: any) => {
      if (first.date > second.date) return 1
      else if (first.date < second.date) return -1
      else return 0
    })

    return res.status(200).json({ success: true, fanwalls: fanwalls })
  } catch (err) {
    console.log(err)
  }
}

/////////////////////////////////////////////////////////////////

export const saveFanwall = async (req: Request, res: Response) => {
  try {
    const { fanwallId, itemId, video, message, posted, embedUrl, cover, sizeType, type } = req.body
    const item: any = type === 'DareMe' ? await DareMe.findById(itemId) : await FundMe.findById(itemId)

    if (fanwallId) {
      const fanwall: any = await Fanwall.findById(fanwallId);
      if (fanwall.video && fanwall.video !== video) {
        const filePath = "public/" + fanwall.video
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) throw err
          })
        }
      }
      if (fanwall.cover && fanwall.cover !== cover) {
        const filePath = "public/" + fanwall.cover
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) throw err
          })
        }
      }

      await Fanwall.findByIdAndUpdate(fanwallId, {
        writer: item.owner,
        dareme: type === 'DareMe' ? itemId : null,
        fundme: type === 'FundMe' ? itemId : null,
        video: video,
        sizeType: sizeType,
        cover: cover,
        message: message,
        embedUrl: embedUrl,
        posted: posted,
        date: calcTime()
      })
    } else {
      const newFanwall = new Fanwall({
        writer: item.owner,
        dareme: type === 'DareMe' ? itemId : null,
        fundme: type === 'FundMe' ? itemId : null,
        video: video,
        sizeType: sizeType,
        cover: cover,
        message: message,
        embedUrl: embedUrl,
        posted: posted,
        date: calcTime()
      })
      await newFanwall.save()
    }

    if (posted) {
      if ((type === 'DareMe' && item.wallet > 0) || (type === "FundMe" && item.empty === false)) {
        const result = await Promise.all([
          User.findById(item.owner),
          AdminWallet.findOne({ admin: "ADMIN" })
        ])

        const user: any = result[0]
        const adminWallet: any = result[1]

        if (item.wallet > 0) {
          req.body.io.to(user.email).emit("wallet_change", user.wallet + item.wallet * 0.9)
          req.body.io.to("ADMIN").emit("wallet_change", adminWallet.wallet + item.wallet * 0.1)

          const transactionAdmin = new AdminUserTransaction({
            description: 4,
            from: type === 'DareMe' ? "DAREME" : 'FUNDME',
            to: "ADMIN",
            dareme: item._id,
            user: item.owner,
            donuts: item.wallet * 0.1,
            date: calcTime()
          });

          const transactionUser = new AdminUserTransaction({
            description: 4,
            from: type === 'DareMe' ? "DAREME" : 'FUNDME',
            to: "USER",
            user: item.owner,
            dareme: item._id,
            donuts: item.wallet * 0.9,
            date: calcTime()
          })

          await Promise.all([
            transactionAdmin.save(),
            transactionUser.save(),
            type === 'DareMe' ? DareMe.findByIdAndUpdate(itemId, { wallet: 0 }) : FundMe.findByIdAndUpdate(itemId, { empty: true }),
            AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet.wallet + item.wallet * 0.1 }),
            User.findByIdAndUpdate(item.owner, { wallet: user.wallet + item.wallet * 0.9 }),
          ])
        }
      }
    }
    return res.status(200).json({ success: true })
  } catch (err) {
    console.log(err);
  }
}

const fanwallStorage = multer.diskStorage({
  destination: "./public/uploads/fanwall/",
  filename: function (req, file, cb) {
    cb(null, "Fanwall-" + Date.now() + path.extname(file.originalname));
  }
});

const uploadFanwall = multer({
  storage: fanwallStorage,
  limits: { fileSize: 100 * 1024 * 1024 },

}).single("file");

export const uploadFile = (req: Request, res: Response) => {
  uploadFanwall(req, res, () => {
    res.status(200).json({ success: true, path: "uploads/fanwall/" + req.file?.filename });
  });
}

export const fanwallGetByDareMeId = async (req: Request, res: Response) => {
  try {
    const { daremeId } = req.params;
    const dareme = await DareMe.findById(daremeId).populate([{ path: 'voteInfo.voter' }, { path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }])
    const fanwall = await Fanwall.findOne({ dareme: daremeId })
      .populate([
        { path: 'writer' },
        { path: 'dareme', populate: [{ path: 'voteInfo.voter' }, { path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }] },
        { path: 'fundme', populate: [{ path: 'owner' }, { path: 'voteInfo.voter' }] }
      ])
    return res.status(200).json({
      success: true,
      payload: {
        dareme: dareme,
        fanwall: fanwall
      }
    })
  } catch (err) {
    console.log(err)
  }
}

export const fanwallGetByFundMeId = async (req: Request, res: Response) => {
  try {
    const { fundmeId } = req.params
    const fundme = await FundMe.findById(fundmeId).populate([{ path: 'owner' }, { path: 'voteInfo.voter' }])
    const fanwall = await Fanwall.findOne({ fundme: fundmeId })
      .populate([
        { path: 'writer' },
        { path: 'dareme', populate: [{ path: 'voteInfo.voter' }, { path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }] },
        { path: 'fundme', populate: [{ path: 'owner' }, { path: 'voteInfo.voter' }] }
      ])
    return res.status(200).json({
      success: true,
      payload: {
        fundme: fundme, fanwall: fanwall
      }
    })
  } catch (err) {
    console.log(err)
  }
}

export const getPostDetail = async (req: Request, res: Response) => {
  try {
    const { fanwallId } = req.params;
    const fanwall: any = await Fanwall.findById(fanwallId)
      .populate([
        { path: 'writer' },
        { path: 'dareme', populate: [{ path: 'voteInfo.voter' }, { path: 'owner' }, { path: 'options.option', populate: { path: 'writer' } }] },
        { path: 'fundme', populate: [{ path: 'owner' }, { path: 'voteInfo.voter' }] }
      ])
    return res.status(200).json({
      success: true,
      payload: {
        fanwall: fanwall
      }
    })
  } catch (err) {
    console.log(err);
  }
}

export const getFanwallsByPersonalUrl = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    let resFanwalls = <Array<any>>[];
    const user: any = await User.findOne({ personalisedUrl: url }).select({ 'name': 1, 'avatar': 1, 'personalisedUrl': 1, 'categories': 1, 'subscribed_users': 1, 'tipFunction': 1 });

    const result: any = await Promise.all([
      DareMe.find({ owner: user._id, published: true, show: true }).populate([{ path: 'owner' }, { path: 'options.option' }]),
      FundMe.find({ owner: user._id, published: true, show: true }).populate({ path: 'owner' }),
      Fanwall.find({ posted: true }).where('writer').ne(user._id).populate([
        { path: 'writer' },
        { path: 'dareme', populate: [{ path: 'options.option', }, { path: 'owner' }] },
        { path: 'fundme', populate: [{ path: 'owner' }] }
      ]),
      Fanwall.find({ writer: user._id, posted: true }).populate([
        { path: 'writer' },
        { path: 'dareme', populate: [{ path: 'options.option' }, { path: 'owner' }] },
        { path: 'fundme', populate: [{ path: 'owner' }] }
      ]),
      Tip.find({ user: user._id, show: true }).populate({ path: 'tipper' })
    ])

    let voters = 0
    const userDaremes = result[0]
    const userFundmes = result[1]

    userDaremes.forEach((dareme: any) => { voters += dareme.voteInfo.filter((vote: any) => vote.superfan === true).length })
    userFundmes.forEach((fundme: any) => { voters += fundme.voteInfo.filter((vote: any) => vote.superfan === true).length })

    const rewardFanwalls = result[2]

    rewardFanwalls.forEach((fanwall: any) => {
      if (fanwall.dareme) {
        const options = fanwall.dareme.options.filter((option: any) => option.option.win === true);
        let isVoted = false;
        for (let i = 0; i < options[0].option.voteInfo.length; i++) {
          const voteInfo = options[0].option.voteInfo[i];
          if ((voteInfo.voter + "" === user.id + "") && voteInfo.donuts >= 50) {
            isVoted = true;
            break;
          }
        }
        if (isVoted) {
          let totalDonuts = 0;
          fanwall.dareme.options.forEach((option: any) => { if (option.option.status === 1) totalDonuts += option.option.donuts; });
          resFanwalls.push({
            id: fanwall._id,
            date: fanwall.date,
            writer: fanwall.writer,
            video: fanwall.video,
            cover: fanwall.cover,
            sizeType: fanwall.sizeType,
            message: fanwall.message,
            embedUrl: fanwall.embedUrl,
            unlocks: fanwall.unlocks,
            dareme: {
              title: fanwall.dareme.title,
              category: fanwall.dareme.category,
              donuts: totalDonuts,
              options: fanwall.dareme.options
            },
            userFanwall: false
          });
        }
      } else {
        let isVoted = false;
        for (let i = 0; i < fanwall.fundme.voteInfo.length; i++) {
          const voteInfo = fanwall.fundme.voteInfo[i];
          if ((voteInfo.voter + "" === user.id + "") && voteInfo.donuts >= 50) {
            isVoted = true;
            break;
          }
        }
        if (isVoted) {
          resFanwalls.push({
            id: fanwall._id,
            date: fanwall.date,
            writer: fanwall.writer,
            video: fanwall.video,
            cover: fanwall.cover,
            sizeType: fanwall.sizeType,
            message: fanwall.message,
            embedUrl: fanwall.embedUrl,
            unlocks: fanwall.unlocks,
            dareme: {
              goal: fanwall.fundme.goal,
              title: fanwall.fundme.title,
              category: fanwall.fundme.category,
              donuts: fanwall.fundme.wallet,
              options: null,
              voteInfo: fanwall.fundme.voteInfo,
              reward: fanwall.fundme.reward
            },
            userFanwall: false
          });
        }
      }
    });

    const fanwalls = result[3];
    fanwalls.forEach((fanwall: any) => {
      if (fanwall.dareme) {
        let totalDonuts = 0;
        fanwall.dareme.options.forEach((option: any) => { if (option.option.status === 1) totalDonuts += option.option.donuts; });
        resFanwalls.push({
          id: fanwall._id,
          date: fanwall.date,
          writer: fanwall.writer,
          video: fanwall.video,
          cover: fanwall.cover,
          sizeType: fanwall.sizeType,
          message: fanwall.message,
          embedUrl: fanwall.embedUrl,
          unlocks: fanwall.unlocks,
          dareme: {
            title: fanwall.dareme.title,
            category: fanwall.dareme.category,
            donuts: totalDonuts,
            options: fanwall.dareme.options
          },
          userFanwall: true
        });
      } else {
        resFanwalls.push({
          id: fanwall._id,
          date: fanwall.date,
          writer: fanwall.writer,
          video: fanwall.video,
          cover: fanwall.cover,
          sizeType: fanwall.sizeType,
          message: fanwall.message,
          embedUrl: fanwall.embedUrl,
          unlocks: fanwall.unlocks,
          dareme: {
            goal: fanwall.fundme.goal,
            title: fanwall.fundme.title,
            category: fanwall.fundme.category,
            donuts: fanwall.fundme.wallet,
            options: null,
            voteInfo: fanwall.fundme.voteInfo,
            reward: fanwall.fundme.reward
          },
          userFanwall: true
        });
      }
    });

    //get Tips data.
    const tips = result[4];
    let resultTips = tips.sort((first: any, second: any) => {
      return first.tip < second.tip ? 1 : first.tip > second.tip ? -1 :
        first.date > second.date ? -1 : first.date < second.date ? 1 : 0;
    });
    return res.status(200).json({
      success: true,
      payload: {
        fanwalls: resFanwalls,
        tips: resultTips,
        user: {
          ...user._doc,
          fanwallCnt: fanwalls.length,
          itemCnt: userDaremes.length + userFundmes.length,
          superfans: voters
        }
      }
    });
  } catch (err) {
    console.log(err);
  }
}

export const likeFanwall = async (req: Request, res: Response) => {
  try {
    const { userId, fanwallId } = req.body;
    const fanwall: any = await Fanwall.findById(fanwallId);
    const filters = fanwall.likes.filter((like: any) => (like.liker + "") === (userId + ""));
    if (filters.length) {
      return res.status(200).json({ success: false });
    } else {
      let likes = fanwall.likes;
      likes.push({ liker: userId });
      await Fanwall.findByIdAndUpdate(fanwallId, { likes: likes });
      const resFanwall = await Fanwall.findById(fanwallId)
        .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
        .populate([
          {
            path: 'dareme',
            model: DareMe,
            populate: [
              {
                path: 'options.option',
                model: Option
              },
              {
                path: 'owner',
                model: User
              }
            ]
          },
          {
            path: 'fundme',
            model: FundMe,
            populate: [
              {
                path: 'owner',
                model: User
              }
            ]
          }
        ]);

      return res.status(200).json({ success: true, fanwall: resFanwall });
    }
  } catch (err) {
    console.log(err);
  }
}

export const unlockFanwall = async (req: Request, res: Response) => {
  try {
    const { userId, fanwallId } = req.body;
    const fanwall: any = await Fanwall.findById(fanwallId);
    const result: any = await Promise.all([
      User.findById(userId),
      User.findById(fanwall.writer),
      AdminWallet.findOne({ admin: "ADMIN" })
    ]);

    const userWallet: any = result[0].wallet - 500;
    const ownerWallet: any = result[1].wallet + 450;
    const adminWallet: any = result[2].wallet + 50;

    const result1: any = await Promise.all([
      User.findByIdAndUpdate(userId, { wallet: userWallet }, { new: true }),
      User.findByIdAndUpdate(fanwall.writer, { wallet: ownerWallet }),
      AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet })
    ]);

    req.body.io.to(result[0].email).emit("wallet_change", userWallet);
    req.body.io.to(result[1].email).emit("wallet_change", ownerWallet);
    req.body.io.to("ADMIN").emit("wallet_change", adminWallet);

    const payload = {
      id: result1[0]._id,
      name: result1[0].name,
      avatar: result1[0].avatar,
      role: result1[0].role,
      email: result1[0].email,
      wallet: result1[0].wallet,
      personalisedUrl: result1[0].personalisedUrl,
      language: result1[0].language,
      category: result1[0].categories,
      new_notification: result1[0].new_notification,
    };

    const currentTime = calcTime();

    const newTransaction1 = new AdminUserTransaction({
      description: 10,
      from: 'USER',
      to: 'ADMIN',
      user: userId,
      donuts: 50,
      date: currentTime
    });

    const newTransaction2 = new AdminUserTransaction({
      description: 10,
      from: 'USER',
      to: 'USER',
      user: userId,
      user1: fanwall.writer,
      donuts: 450,
      date: currentTime
    });

    await Promise.all([
      newTransaction1.save(),
      newTransaction2.save()
    ])

    let unlocks = fanwall.unlocks;
    unlocks.push({ unlocker: userId });
    await Fanwall.findByIdAndUpdate(fanwallId, { unlocks: unlocks });
    const resFanwall: any = await Fanwall.findById(fanwallId)
      .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
      .populate([
        {
          path: 'dareme',
          model: DareMe,
          populate: [
            {
              path: 'options.option',
              model: Option
            },
            {
              path: 'owner',
              model: User
            }
          ]
        },
        {
          path: 'fundme',
          model: FundMe,
          populate: [
            {
              path: 'owner',
              model: User
            }
          ]
        }
      ]);

    return res.status(200).json({ success: true, fanwall: resFanwall, user: payload });
  } catch (err) {
    console.log(err);
  }
}

export const deleteFanwall = async (req: Request, res: Response) => {
  try {
    const { fanwallId } = req.params;
    const fanwall: any = await Fanwall.findById(fanwallId);
    if (fanwall.video) {
      const filePath = "public/" + fanwall.video;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    if (fanwall.cover) {
      const filePath = "public/" + fanwall.cover;
      fs.unlink(filePath, (err) => {
        if (err) throw err;
      });
    }
    await Fanwall.findByIdAndDelete(fanwallId);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}


/**
 * 
 * 
 */
export const modityIssue = async (req: Request, res: Response) => {
  try {
    const transactions = await AdminUserTransaction.find({ description: 4 });
    if (transactions.length > 0) {
      transactions.map((item: any) => {
        if (item.from == 'DAREME' && new Date(item.date) < new Date('2022-06-19T21:00:00.000Z')) {
          if (item.to == 'ADMIN') {
            AdminUserTransaction.findByIdAndUpdate(item._id, { to: 'USER' }).then((r: any) => console.log(r));
          } else if (item.to == 'USER') {
            AdminUserTransaction.findByIdAndUpdate(item._id, { to: 'ADMIN' }).then((r: any) => console.log(r));
          }
        }
      });
      return res.status(200).json({ success: true });
    }
    return res.status(200).json({ success: true, status: 0 })
  } catch (err) {
    return res.status(200).json({ error: err });
  }
}

export const getTransaction = async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const transaction = await AdminUserTransaction.findById(transactionId);
  if (transaction) {
    return res.status(200).json(transaction);
  } else return res.status(200).json({ error: true });
}


export const setTransaction = async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const { donuts, description, from, to } = req.body;
  await AdminUserTransaction.findByIdAndUpdate(transactionId, { from: from, to: to, description: description, donuts: donuts });
  return res.status(200).json({ success: true });
}

export const setUser = async (req: Request, res: Response) => {
  const transactions: any = await AdminUserTransaction.find({ description: 4, from: 'DAREME', to: 'USER' });
  if (transactions.length > 0) {
    for (const item of transactions) {
      let admin: any = await AdminUserTransaction.findOne({ dareme: item.dareme, description: 4, from: 'DAREME', to: 'ADMIN' });
      await AdminUserTransaction.findByIdAndUpdate(item._id, { user: admin.user ? admin.user : item.user ? item.user : 'admin' });
    }
    return res.status(200).json({ success: true });
  } else return res.status(200).json({ error: true });
}

export const checkTransaction = async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const log: any = await AdminUserTransaction.findById(transactionId);
  const result = await AdminUserTransaction.findOne({ dareme: log.dareme, description: 4, from: 'DAREME', to: 'USER' });
  if (result) return res.status(200).json(result);
  else return res.status(200).json({ error: true });
}

export const dumpFanwall = async (req: Request, res: Response) => {
  const fanwalls = await Fanwall.find({});
  return res.status(200).json(fanwalls);
}
