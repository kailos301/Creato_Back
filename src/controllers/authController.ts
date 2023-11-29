import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import User from "../models/User";
import DareMe from "../models/DareMe";
import FundMe from "../models/FundMe"
import AdminWallet from "../models/AdminWallet";
import GeneralSetting from "../models/GeneralSetting";
import ReferralLink from "../models/ReferralLink";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import voucher_codes from 'voucher-code-generator'
import Mixpanel from "mixpanel";
import 'dotenv/config'
import CONSTANT from "../utils/constant"

const mixpanel = Mixpanel.init(`${process.env.MIXPANEL_TOKEN}`)
var mixpanel_importer = Mixpanel.init(`${process.env.MIXPANEL_TOKEN}`, {
  secret: `${process.env.MIXPANEL_API_SECRET}`
});

const welcomeDonuts = 10;

function calcTime() {
  var d = new Date();
  var utc = d.getTime();
  var nd = new Date(utc + (3600000 * 8));
  return nd;
}

export const setFirstLogin = async () => {
  try {
    const users: any = await User.find()
    let setFuncs: Array<any> = []
    for (const user of users) setFuncs.push(User.findByIdAndUpdate(user._id, { firstLogin: false }))
    Promise.all(setFuncs)
  } catch (err) {
    console.log(err)
  }
}

export const getTipState = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body
    const result: any = await Promise.all([
      DareMe.find({ owner: userId, finished: true }),
      FundMe.find({ owner: userId, finished: true }),
      User.findById(userId)
    ])
    const cnt = result[0].length + result[1].length
    return res.status(200).json({ success: true, cnt: cnt, tipFunction: result[2].tipFunction })
  } catch (err) {
    console.log(err)
  }
}

//-------------Google Signin---------------------------
export const googleSignin = async (req: Request, res: Response) => {
  try {
    const userData = req.body
    const email = userData.email
    const browser = userData.browser

    const user: any = await User.findOne({ email: email });
    const adminDonuts: any = await AdminWallet.findOne({ admin: "ADMIN" });
    if (user) {
      if (user.language !== userData.lang) await User.findByIdAndUpdate(user._id, { language: userData.lang })
      const password = userData.email + userData.googleId;
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (isMatch) {
          let wallet = user.wallet;
          if (user.role === "ADMIN") wallet = adminDonuts.wallet;

          const payload = {
            id: user._id,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
            wallet: wallet,
            email: user.email,
            personalisedUrl: user.personalisedUrl,
            language: userData.lang,
            category: user.categories,
            new_notification: user.new_notification,
            referralLink: user.referralLink
          };

          jwt.sign(
            payload,
            `${process.env.KEY}`,
            { expiresIn: CONSTANT.SESSION_EXPIRE_TIME_IN_SECONDS },
            (err, token) => {
              mixpanel.people.set_once(user._id, {
                $name: user.name,
                $email: user.email,
              });
              mixpanel.track("Sign In", {
                'Login Method': 'Gmail',
                'Browser Used': browser,
                distinct_id: user._id,
                $name: user.name,
                $email: user.email,
              });

              const firstLogin = user.firstLogin
              User.findByIdAndUpdate(user._id, { firstLogin: true }).exec()
              return res.status(200).json({ user: payload, token: token, firstLogin: firstLogin });
            }
          );
        } else return res.status(400).json({ error: 'sing-up methods error' })
      });
    } else googleSignup(req, res);
  } catch (err) {
    console.log(err);
  }
}

//-------------Google Signup---------------------------
export const googleSignup = async (req: Request, res: Response) => {
  try {
    const userData = req.body;
    const email = userData.email;
    const browser = userData.browser;
    const referral = userData.referral
    let role = "USER"

    const result = await Promise.all([
      GeneralSetting.findOne(),
      AdminWallet.findOne(),
      User.findOne({ email: email })
    ])

    const generalSetting: any = result[0]
    const adminDonuts: any = result[1]
    const user: any = result[2]

    let referralLink: any = null
    if (referral.userId) referralLink = await ReferralLink.findOne({ user: referral.userId })
    if (user) googleSignin(req, res)
    else {
      const users = await User.find()
      let link: any = null
      while (1) {
        let flag = false
        const links = voucher_codes.generate({
          length: 10,
          count: 1,
          charset: '0123456789abcdefghijklmnopqrstuvwxyz',
        })
        users.forEach((user: any) => { if (user.referralLink === links[0]) flag = true })
        if (flag === false) {
          link = links[0]
          break
        }
      }

      const password = userData.email + userData.googleId;
      bcrypt.genSalt(10, (err: any, salt: any) => {
        bcrypt.hash(password, salt, (err: any, hash: any) => {
          if (err) throw err;
          const newUser = new User({
            email: userData.email,
            avatar: userData.avatar,
            name: userData.name,
            wallet: welcomeDonuts,
            role: role,
            password: hash,
            language: userData.lang,
            referralLink: link,
            date: calcTime()
          });
          newUser.save().then((user: any) => {
            const index = user.email.indexOf("@");
            const subEmail = user.email.substring(0, index).replace(/\s/g, '').toLowerCase();
            User.find({ personalisedUrl: subEmail }).then((foundUsers: any) => {
              let url = "";
              if (foundUsers.length > 1) url = `${subEmail}${foundUsers.length - 1}`;
              else url = subEmail;
              User.findOneAndUpdate({ _id: user._id }, { $set: { personalisedUrl: url } }, { new: true })
                .then((updatedUser: any) => {
                  let wallet = updatedUser.wallet;
                  if (updatedUser.role === "ADMIN") wallet = adminDonuts.wallet;
                  const payload = {
                    id: updatedUser._id,
                    name: updatedUser.name,
                    avatar: updatedUser.avatar,
                    role: updatedUser.role,
                    email: updatedUser.email,
                    wallet: wallet,
                    personalisedUrl: updatedUser.personalisedUrl,
                    language: updatedUser.language,
                    category: updatedUser.categories,
                    new_notification: updatedUser.new_notification,
                    referralLink: user.referralLink
                  };
                  jwt.sign(
                    payload,
                    `${process.env.KEY}`,
                    { expiresIn: CONSTANT.SESSION_EXPIRE_TIME_IN_SECONDS },
                    (err, token) => {
                      mixpanel.people.set_once(updatedUser._id, {
                        $name: updatedUser.name,
                        $email: updatedUser.email,
                      });

                      if (referralLink) {
                        let users = [...referralLink.invitedUsers]
                        users[referral.index] = {
                          date: users[referral.index].date,
                          newUser: updatedUser._id,
                          reward: generalSetting.referralLinkDonuts,
                          earned: false,
                        }

                        ReferralLink.findByIdAndUpdate(referralLink._id, {
                          expected: referralLink.expected + generalSetting.referralLinkDonuts,
                          invitedUsers: users
                        }).exec()
                      }

                      mixpanel.track("Sign Up", {
                        'Sign Up Method': 'Gmail',
                        'Browser Used': browser,
                        distinct_id: updatedUser._id,
                        $name: updatedUser.name,
                        $email: updatedUser.email,
                      });
                      return res.status(200).json({ user: payload, token: token, new: true });
                    }
                  );
                }).catch((err: any) => console.log(err));
            }).catch((err: any) => console.log(err));
          }).catch((err: any) => console.log(err));
        });
      });
    }
  } catch (err) {
    console.log(err);
  }
}

export const appleSignin = async (req: Request, res: Response) => {
  try {
    const userData = req.body
    const token = userData.token
    const browser = userData.browser

    const decodeToken: any = jwt.decode(token)
    const user: any = await User.findOne({ email: decodeToken.email });
    const adminDonuts: any = await AdminWallet.findOne({ admin: "ADMIN" });
    if (user) {
      if (user.language !== userData.lang) await User.findByIdAndUpdate(user._id, { language: userData.lang })
      const password = decodeToken.email + decodeToken.sub;
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (isMatch) {
          let wallet = user.wallet;
          if (user.role === "ADMIN") wallet = adminDonuts.wallet;
          const payload = {
            id: user._id,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
            wallet: wallet,
            email: user.email,
            personalisedUrl: user.personalisedUrl,
            language: userData.lang,
            category: user.categories,
            new_notification: user.new_notification,
            referralLink: user.referralLink
          };

          jwt.sign(
            payload,
            `${process.env.KEY}`,
            { expiresIn: CONSTANT.SESSION_EXPIRE_TIME_IN_SECONDS },
            (err, token) => {
              mixpanel.people.set_once(user._id, {
                $name: user.name,
                $email: user.email,
              });
              mixpanel.track("Sign In", {
                'Login Method': 'Apple',
                'Browser Used': browser,
                distinct_id: user._id,
                $name: user.name,
                $email: user.email,
              });

              const firstLogin = user.firstLogin
              User.findByIdAndUpdate(user._id, { firstLogin: true }).exec()
              return res.status(200).json({ user: payload, token: token, firstLogin: firstLogin });
            }
          );
        } else return res.status(400).json({ error: 'sing-up methods error' })
      });
    } else appleSignup(req, res);
  } catch (err) {
    console.log(err);
  }
}

export const appleSignup = async (req: Request, res: Response) => {
  try {
    const userData = req.body
    const token = userData.token
    const browser = userData.browser
    const appleUser = userData.user
    const referral = userData.referral

    const decodeToken: any = jwt.decode(token)

    const result: any = await Promise.all([
      GeneralSetting.findOne(),
      AdminWallet.findOne(),
      User.findOne({ email: decodeToken.email })
    ])

    const generalSetting = result[0]
    const adminDonuts = result[1]
    const user = result[2]

    let referralLink: any = null
    if (referral.userId) referralLink = await ReferralLink.findOne({ user: referral.userId })
    if (user) appleSignin(req, res)
    else {
      const users: any = await User.find()
      let link: any = null
      while (1) {
        let flag = false
        const links = voucher_codes.generate({
          length: 10,
          count: 1,
          charset: '0123456789abcdefghijklmnopqrstuvwxyz',
        })
        users.forEach((user: any) => { if (user.referralLink === links[0]) flag = true })
        if (flag === false) {
          link = links[0]
          break
        }
      }

      const password = decodeToken.email + decodeToken.sub
      bcrypt.genSalt(10, (err: any, salt: any) => {
        bcrypt.hash(password, salt, (err: any, hash: any) => {
          if (err) throw err;
          const i = decodeToken.email.indexOf("@");
          const alterName = decodeToken.email.substring(0, i)
          const newUser = new User({
            email: decodeToken.email,
            name: appleUser ? appleUser.firstName + ' ' + appleUser.lastName : alterName,
            wallet: welcomeDonuts,
            role: 'USER',
            password: hash,
            language: userData.lang,
            referralLink: link,
            date: calcTime()
          });
          newUser.save().then((user: any) => {
            const index = user.email.indexOf("@");
            const subEmail = user.email.substring(0, index).replace(/\s/g, '').toLowerCase();
            User.find({ personalisedUrl: subEmail }).then((foundUsers: any) => {
              let url = "";
              if (foundUsers.length > 1) url = `${subEmail}${foundUsers.length - 1}`;
              else url = subEmail;
              User.findOneAndUpdate({ _id: user._id }, { $set: { personalisedUrl: url } }, { new: true })
                .then((updatedUser: any) => {
                  let wallet = updatedUser.wallet;
                  if (updatedUser.role === "ADMIN") wallet = adminDonuts.wallet;
                  const payload = {
                    id: updatedUser._id,
                    name: updatedUser.name,
                    avatar: updatedUser.avatar,
                    role: updatedUser.role,
                    email: updatedUser.email,
                    wallet: wallet,
                    personalisedUrl: updatedUser.personalisedUrl,
                    language: updatedUser.language,
                    category: updatedUser.categories,
                    new_notification: updatedUser.new_notification,
                    referralLink: user.referralLink
                  };
                  jwt.sign(
                    payload,
                    `${process.env.KEY}`,
                    { expiresIn: CONSTANT.SESSION_EXPIRE_TIME_IN_SECONDS },
                    (err, token) => {
                      mixpanel.people.set_once(updatedUser._id, {
                        $name: updatedUser.name,
                        $email: updatedUser.email,
                      });

                      if (referralLink) {
                        let users = [...referralLink.invitedUsers]
                        users[referral.index] = {
                          date: users[referral.index].date,
                          newUser: updatedUser._id,
                          reward: generalSetting.referralLinkDonuts,
                          earned: false,
                        }

                        ReferralLink.findByIdAndUpdate(referralLink._id, {
                          expected: referralLink.expected + generalSetting.referralLinkDonuts,
                          invitedUsers: users
                        }).exec()
                      }

                      mixpanel.track("Sign Up", {
                        'Sign Up Method': 'Apple',
                        'Browser Used': browser,
                        distinct_id: updatedUser._id,
                        $name: updatedUser.name,
                        $email: updatedUser.email,
                      });
                      return res.status(200).json({ user: payload, token: token, new: true });
                    }
                  );
                }).catch((err: any) => console.log(err));
            }).catch((err: any) => console.log(err));
          }).catch((err: any) => console.log(err));
        });
      });
    }
  } catch (err) {
    console.log(err);
  }
}

export const facebookSignin = async (req: Request, res: Response) => {
  try {
    const userData = req.body;
    const email = userData.email;
    const browser = userData.browser;

    const user: any = await User.findOne({ email: email });
    const adminDonuts: any = await AdminWallet.findOne({ admin: "ADMIN" });
    if (user) {
      const password = userData.email + userData.facebookId;
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (isMatch) {
          let wallet = user.wallet;
          if (user.role === "ADMIN") wallet = adminDonuts.wallet;
          const payload = {
            id: user._id,
            name: user.name,
            avatar: user.avatar,
            role: user.role,
            wallet: wallet,
            email: user.email,
            personalisedUrl: user.personalisedUrl,
            language: user.language,
            category: user.categories,
            new_notification: user.new_notification,
          };

          jwt.sign(
            payload,
            `${process.env.KEY}`,
            { expiresIn: CONSTANT.SESSION_EXPIRE_TIME_IN_SECONDS },
            (err, token) => {
              mixpanel.people.set_once(user._id, {
                $name: user.name,
                $email: user.email,
              });
              mixpanel.track("Sign In", {
                'Login Method': 'Facebook',
                'Browser Used': browser,
                distinct_id: user._id,
                $name: user.name,
                $email: user.email,
              });
              return res.status(200).json({ user: payload, token: token });
            }
          );
        } else return res.status(400).json({ error: "Error Google Login" });
      });
    } else facebookSignup(req, res);
  } catch (err) {
    console.log(err);
  }
}

export const facebookSignup = async (req: Request, res: Response) => {
  try {
    const userData = req.body;
    const email = userData.email;
    const browser = userData.browser;
    const adminWallet: any = await AdminWallet.find({});
    let role = "USER";
    if (adminWallet.length === 0) {
      role = "ADMIN";
      const admin = new AdminWallet({ admin: "ADMIN", date: calcTime() });
      await admin.save();
    }
    const adminDonuts: any = await AdminWallet.findOne({ admin: "ADMIN" });
    const user: any = await User.findOne({ email: email });
    if (user) facebookSignin(req, res)
    else {
      const password = userData.email + userData.facebookId;
      bcrypt.genSalt(10, (err: any, salt: any) => {
        bcrypt.hash(password, salt, (err: any, hash: any) => {
          if (err) throw err;
          const newUser = new User({
            email: userData.email,
            avatar: userData.avatar,
            name: userData.name,
            wallet: welcomeDonuts,
            role: role,
            password: hash,
            language: userData.lang,
            date: calcTime()
          });
          newUser.save().then((user: any) => {
            const index = user.email.indexOf("@");
            const subEmail = user.email.substring(0, index).replace(/\s/g, '').toLowerCase();
            User.find({ personalisedUrl: subEmail }).then((foundUsers: any) => {
              let url = "";
              if (foundUsers.length > 1) url = `${subEmail}${foundUsers.length - 1}`;
              else url = subEmail;
              User.findOneAndUpdate({ _id: user._id }, { $set: { personalisedUrl: url } }, { new: true })
                .then((updatedUser: any) => {
                  let wallet = updatedUser.wallet;
                  if (updatedUser.role === "ADMIN") wallet = adminDonuts.wallet;
                  const payload = {
                    id: updatedUser._id,
                    name: updatedUser.name,
                    avatar: updatedUser.avatar,
                    role: updatedUser.role,
                    email: updatedUser.email,
                    wallet: wallet,
                    personalisedUrl: updatedUser.personalisedUrl,
                    language: updatedUser.language,
                    category: updatedUser.categories,
                    new_notification: updatedUser.new_notification,
                  };
                  jwt.sign(
                    payload,
                    `${process.env.KEY}`,
                    { expiresIn: CONSTANT.SESSION_EXPIRE_TIME_IN_SECONDS },
                    (err, token) => {
                      mixpanel.people.set_once(updatedUser._id, {
                        $name: updatedUser.name,
                        $email: updatedUser.email,
                      });
                      mixpanel.track("Sign Up", {
                        'Sign Up Method': 'Facebook',
                        'Browser Used': browser,
                        distinct_id: updatedUser._id,
                        $name: updatedUser.name,
                        $email: updatedUser.email,
                      });
                      return res.status(200).json({ user: payload, token: token, new: true });
                    }
                  );
                }).catch((err: any) => console.log(err));
            }).catch((err: any) => console.log(err));
          }).catch((err: any) => console.log(err));
        });
      });
    }
  } catch (err) {
    console.log(err);
  }
}

export const getAuthData = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const user: any = await User.findById(userId);
    // if (!user) return res.status(200).json({ user: null });
    const adminDonuts: any = await AdminWallet.findOne({ admin: "ADMIN" });
    const payload = {
      id: user._id,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      email: user.email,
      wallet: user.role === "ADMIN" ? adminDonuts.wallet : user.wallet,
      personalisedUrl: user.personalisedUrl,
      language: user.language,
      category: user.categories,
      new_notification: user.new_notification,
    };
    return res.status(200).json({ user: payload });
  } catch (err) {
    console.log(err);
  }
}

export const saveProfileInfo = async (req: Request, res: Response) => {
  try {
    const { userId, name, creatoUrl, category, path } = req.body
    const user: any = await User.findById(userId)
    let realPath = user.avatar
    if (path) {
      realPath = path
      if (user.avatar.indexOf('uploads') !== -1) {
        const filePath = "public/" + user.avatar
        if (fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) throw err
          })
        }
      }
    }
    const updatedUser: any = await User.findByIdAndUpdate(userId, { name: name, personalisedUrl: creatoUrl, categories: category, avatar: realPath }, { new: true })
    const adminDonuts: any = await AdminWallet.findOne({ admin: "ADMIN" })
    const payload = {
      id: updatedUser._id,
      name: updatedUser.name,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      email: updatedUser.email,
      wallet: updatedUser.role === "ADMIN" ? adminDonuts.wallet : updatedUser.wallet,
      personalisedUrl: updatedUser.personalisedUrl,
      language: updatedUser.language,
      category: updatedUser.categories,
      new_notification: updatedUser.new_notification,
    };
    return res.status(200).json({ user: payload, success: true })
  } catch (err) {
    console.log(err);
  }
}

const avatarStorage = multer.diskStorage({
  destination: "./public/uploads/avatar/",
  filename: function (req, file, cb) {
    cb(null, "Avatar-" + Date.now() + path.extname(file.originalname));
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 30 * 1024 * 1024 },
}).single("file");

export const editAvatar = async (req: Request, res: Response) => {
  uploadAvatar(req, res, () => {
    res.status(200).json({ success: true, path: "uploads/avatar/" + req.file?.filename });
  });
}

export const setLanguage = async (req: Request, res: Response) => {
  try {
    const { userId, lang } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, { language: lang }, { new: true });
    if (updatedUser) return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export const getUsersList = async (req: Request, res: Response) => {
  try {
    const { search } = req.body;
    if (search === "") {
      const users = await User.find().select({ 'personalisedUrl': 1, 'date': 1, 'email': 1, 'name': 1, 'categories': 1, 'wallet': 1, 'tipFunction': 1, 'role': 1 });
      var dareFuncs: Array<any> = [];
      users.forEach((user: any) => { dareFuncs.push(DareMe.find({ owner: user._id })) });
      const resultDaremes = await Promise.all(dareFuncs);
      var result: Array<object> = [];
      users.forEach((user: any, index: any) => {
        result.push({
          id: user._id,
          personalisedUrl: user.personalisedUrl,
          date: user.date,
          email: user.email,
          name: user.name,
          categories: user.categories,
          wallet: user.wallet,
          role: user.role,
          daremeCnt: resultDaremes[index].length,
          tipFunction: user.tipFunction
        });
      });
    } else {
      const users = await User.find({
        $or:
          [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { personalisedUrl: { $regex: search, $options: "i" } }
          ]
      }).select({ 'personalisedUrl': 1, 'date': 1, 'email': 1, 'name': 1, 'categories': 1, 'wallet': 1, 'tipFunction': 1, 'role': 1 });
      var dareFuncs: Array<any> = [];
      users.forEach((user: any) => { dareFuncs.push(DareMe.find({ owner: user._id })) });
      const resultDaremes = await Promise.all(dareFuncs);
      var result: Array<object> = [];
      users.forEach((user: any, index: any) => {
        result.push({
          id: user._id,
          personalisedUrl: user.personalisedUrl,
          date: user.date,
          email: user.email,
          name: user.name,
          role: user.role,
          categories: user.categories,
          wallet: user.wallet,
          daremeCnt: resultDaremes[index].length,
          tipFunction: user.tipFunction
        });
      });
    }
    return res.status(200).json({ success: true, users: result });
  } catch (err) {
    console.log(err);
  }
}

export const getExistName = async (req: Request, res: Response) => {
  try {
    const { name, userId } = req.body;
    const users = await User.find({ name: new RegExp(`^${name}$`, 'i') }).where('_id').ne(userId);
    return res.status(200).json({ success: true, isExist: users.length > 0 ? true : false });
  } catch (err) {
    console.log(err);
  }
}

export const getExistURL = async (req: Request, res: Response) => {
  try {
    const { url, userId } = req.body;
    const users = await User.find({ personalisedUrl: new RegExp(`^${url}$`, 'i') }).where('_id').ne(userId);
    return res.status(200).json({ success: true, isExist: users.length > 0 ? true : false });
  } catch (err) {
    console.log(err);
  }
}

export const getUserFromUrl = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const user = await User.find({ personalisedUrl: url });
    return res.status(200).json({ success: true, user: user });
  } catch (err) {
    console.log(err);
  }
}

export const inviteFriend = async (req: Request, res: Response) => {
  try {
    const { referralLink } = req.body
    const user: any = await User.findOne({ referralLink: referralLink })
    const referral: any = await ReferralLink.findOne({ user: user._id })
    let index = 0
    if (referral) {

      let users = [...referral.invitedUsers]
      users.push({ date: calcTime() })
      index = referral.invitedUsers.length
      await ReferralLink.findByIdAndUpdate(referral._id, { invitedUsers: users })

    } else {

      const newReferral = new ReferralLink({
        user: user._id,
        invitedUsers: [{ date: calcTime() }]
      })
      await newReferral.save()

    }

    return res.status(200).json({ success: true, data: { index: index, userId: user._id } })
  } catch (err) {
    console.log(err)
  }
}

export const getCreatorsByCategory = async (req: Request, res: Response) => {
  try {
    const { categories } = req.body
    const finishedDareme = DareMe.find({ finished: true }).populate({ path: 'owner' })
    const finishedFundme = FundMe.find({ finished: true }).populate({ path: 'owner' })

    const result: any = await Promise.all([finishedDareme, finishedFundme])

    let users = <Array<any>>[];
    for (const dareme of result[0]) {
      const filters = users.filter((user: any) => (user._id + '') === (dareme.owner._id + ''))
      if (filters.length === 0 && dareme.owner.role === 'USER') {
        users.push(dareme.owner);
      }
    }

    for (const fundme of result[1]) {
      const filters = users.filter((user: any) => (user._id + '') === (fundme.owner._id + ''))
      if (filters.length === 0 && fundme.owner.role === 'USER') {
        users.push(fundme.owner);
      }
    }
    if (categories.length !== 0) {
      const filterUsers = users.filter((user: any) => {
        for (let i = 0; i < categories.length; i++) if (user.categories.indexOf(categories[i]) !== -1) return true
        return false
      })
      users = [...filterUsers]
    }

    const newArr1 = users.slice()
    for (let i = newArr1.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1));
      [newArr1[i], newArr1[rand]] = [newArr1[rand], newArr1[i]];
    }

    return res.status(200).json({ success: true, creators: newArr1 })
  } catch (err) {
    console.log(err)
  }
}