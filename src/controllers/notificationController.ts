import { Request, Response } from "express";
import User from "../models/User";
import Notification from "../models/Notification";
import NotificationSetting from "../models/NotificationSetting";
import NotificationType from "../models/NotificationType";

function calcTime() {
  var d = new Date();
  var utc = d.getTime();
  var nd = new Date(utc + (3600000 * 8));
  return nd;
}

export const getNotificationHistory = async (req: Request, res: Response) => {
  try {
    const notifications: any = await Notification.find()
      .populate([
        { path: 'dareme', select: { title: 1 }, populate: { path: 'owner' } },
        { path: 'fundme', select: { title: 1 }, populate: { path: 'owner' } },
        { path: 'sender', select: { role: 1, avatar: 1, name: 1 } },
        { path: 'section' },
        { path: 'option' },
        { path: 'tip', populate: [{ path: 'user' }, { path: 'tipper' }] },
        { path: 'receiverInfo.receiver', select: { name: 1 } }
      ]).sort({ date: -1 }).select({ receiverInfo: 1, dareme: 1, fundme: 1, sender: 1, section: 1, index: 1, date: 1, donuts: 1, option: 1 });

    let result: Array<any> = []

    for (const notification of notifications) {
      let msg = notification.section.info[notification.index].contentEn
      if (msg.indexOf('DAREME_TITLE') !== -1) msg = msg.replace(/DAREME_TITLE/g, `<strong>${notification.dareme?.title}</strong>`)
      if (msg.indexOf('FUNDME_TITLE') !== -1) msg = msg.replace('FUNDME_TITLE', `<strong>${notification.fundme?.title}</strong>`)
      if (msg.indexOf('NAME_OF_OWNER') !== -1) {
        if (notification.dareme) msg = msg.replace('NAME_OF_OWNER', `<strong>${notification.dareme.owner.name}</strong>`)
        else if (notification.fundme) msg = msg.replace('NAME_OF_OWNER', `<strong>${notification.fundme.owner.name}</strong>`)
      }
      if (msg.indexOf('NAME_OF_DONOR') !== -1) msg = msg.replace('NAME_OF_DONOR', `<strong>${notification.tip.nickname ? notification.tip.nickname : notification.tip.tipper.name }</strong>`)
      if (msg.indexOf('NAME_OF_CREATOR') !== -1) msg = msg.replace(/NAME_OF_CREATOR/g, `<strong>${notification.tip.user.name}</strong>`)
      if (msg.indexOf('NAME_OF_VOTER') !== -1) msg = msg.replace('NAME_OF_VOTER', `<strong>${notification.sender.name}</strong>`)
      if (msg.indexOf('NAME_OF_DARE') !== -1) msg = msg.replace('NAME_OF_DARE', `<strong>${notification.option.title}</strong>`);
      if (msg.indexOf('WINNING_DARE_NAME') !== -1) msg = msg.replace('WINNING_DARE_NAME', `<strong>${notification?.option.title}</strong>`);
      if (msg.indexOf('NUMBER_OF_DONUTS') !== -1) msg = msg.replace('NUMBER_OF_DONUTS', `<strong>${notification.donuts}</strong>`)

      for (const resInfo of notification.receiverInfo) {
        result.push({
          id: notification._id,
          section: notification.section.section,
          condition: notification.section.info[notification.index],
          sender: notification.sender,
          receiver: resInfo.receiver,
          date: notification.date,
          msg: msg
        });
      }
    }

    return res.status(200).json({ success: true, list: result });
  } catch (err) {
    console.log(err);
  }
}

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const user: any = await User.findById(userId)

    const notifications: any = await Notification.find({ receiverInfo: { $elemMatch: { receiver: userId } } })
      .populate([
        { path: 'dareme', select: { title: 1 }, populate: { path: 'owner' } },
        { path: 'fundme', select: { title: 1 }, populate: { path: 'owner' } },
        { path: 'sender', select: { role: 1, avatar: 1, name: 1 } },
        { path: 'section' },
        { path: 'option' },
        { path: 'tip', populate: [{ path: 'user' }, { path: 'tipper' }] },
        { path: 'receiverInfo.receiver', select: { name: 1 } }
      ]).sort({ date: -1 }).select({ receiverInfo: 1, dareme: 1, sender: 1, section: 1, index: 1, date: 1, option: 1, donuts: 1 });

    let result: Array<any> = [];
    let count = 0;

    notifications.forEach((notification: any) => {
      let msg = notification.section.info[notification.index].contentEn
      if (user.language === 'CH' && notification.section.info[notification.index].contentCh && notification.section.info[notification.index].contentCh !== '')
        msg = notification.section.info[notification.index].contentCh
      console.log()
      if (msg.indexOf('DAREME_TITLE') !== -1) msg = msg.replace(/DAREME_TITLE/g, `<strong>${notification.dareme.title}</strong>`);
      if (msg.indexOf('FUNDME_TITLE') !== -1) msg = msg.replace('FUNDME_TITLE', `<strong>${notification.fundme.title}</strong>`);
      if (msg.indexOf('NAME_OF_OWNER') !== -1) {
        if (notification.dareme) msg = msg.replace('NAME_OF_OWNER', `<strong>${notification.dareme.owner.name}</strong>`)
        else if (notification.fundme) msg = msg.replace('NAME_OF_OWNER', `<strong>${notification.fundme.owner.name}</strong>`)
      }
      if (msg.indexOf('NAME_OF_DONOR') !== -1) msg = msg.replace('NAME_OF_DONOR', `<strong>${notification.tip.nickname ? notification.tip.nickname : notification.tip.tipper.name }</strong>`)
      if (msg.indexOf('NAME_OF_CREATOR') !== -1) msg = msg.replace(/NAME_OF_CREATOR/g, `<strong>${notification.tip.user.name}</strong>`)
      if (msg.indexOf('NAME_OF_VOTER') !== -1) msg = msg.replace('NAME_OF_VOTER', `<strong>${notification.sender.name}</strong>`);
      if (msg.indexOf('NAME_OF_DARE') !== -1) msg = msg.replace('NAME_OF_DARE', `<strong>${notification.option.title}</strong>`);
      if (msg.indexOf('WINNING_DARE_NAME') !== -1) msg = msg.replace('WINNING_DARE_NAME', `<strong>${notification?.option.title}</strong>`);
      if (msg.indexOf('NUMBER_OF_DONUTS') !== -1) msg = msg.replace('NUMBER_OF_DONUTS', `<strong>${notification.donuts}</strong>`);

      const resInfo = notification.receiverInfo.filter((info: any) => (info.receiver._id + '') === (userId + ''));
      if (resInfo[0].read === false) count++;

      result.push({
        id: notification._id,
        index: notification.index,
        section: notification.section,
        sender: notification.sender,
        receiver: resInfo[0].receiver,
        donuts: notification.donuts,
        read: resInfo[0].read,
        dareme: notification.dareme ? notification.dareme : null,
        fundme: notification.fundme ? notification.fundme : null,
        date: notification.date,
        tip: notification.tip,
        msg: msg
      });
    });

    if (count === 0) await User.findByIdAndUpdate(userId, { new_notification: false });

    return res.status(200).json({ success: true, list: result });
  } catch (err) {
    console.log({ err });
  }
};

export const readNotification = async (req: Request, res: Response) => {
  try {
    const { notificationId, userId, readCount } = req.body;

    const notification: any = await Notification.findById(notificationId);
    const receiverInfo = notification.receiverInfo;
    let result: Array<any> = [];
    receiverInfo.forEach((info: any) => {
      if ((info.receiver + '') === (userId + '')) {
        result.push({
          receiver: info.receiver,
          read: true,
          read_at: calcTime()
        });
      } else result.push(info);
    });

    await Notification.findByIdAndUpdate(notificationId, { receiverInfo: result });
    if (readCount === 0) await User.findByIdAndUpdate(userId, { new_notification: false });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log({ err });
    res.json({ err });
  }
};

export const setNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const updatedUser: any = await User.findByIdAndUpdate(userId, { new_notification: true }, { new: true });
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

    return res.status(200).json({ user: payload, success: true });
  } catch (err) {
    console.log(err);
  }
};

export const subscribeUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const user: any = await User.findOne({ _id: id });
    const found = user.subscribed_users.find(
      (user: any) => user + "" === userId + ""
    );
    if (found) {
      let subscribed_users = user.subscribed_users.filter(
        (user: any) => user + "" !== userId
      );
      user.subscribed_users = subscribed_users;
    } else {
      user.subscribed_users.push(userId);
    }
    await user.save();
    res.status(200).json({ success: true });
  } catch (err) {
    console.log({ err });
  }
};

export const addNewNotification = async (io: any, data: any) => {
  try {
    const type: any = await NotificationType.findOne({ section: data.section });
    if (type === null) {
      console.log('Get Notification Type Error');
      return;
    }

    let currentTime = calcTime();
    let notifications: Array<any> = [];
    let notifyUsers: Array<any> = [];
    let setUserNotifyTrue: Array<any> = [];

    if (data.section === 'Create DareMe') {
      var index = 0;
      const result = await Promise.all([
        User.findById(data.dareme.owner),
        User.findOne({ role: 'ADMIN' })
      ]);
      const user: any = result[0];

      for (const info of type.info) {
        if (info.auto && info.trigger === data.trigger) {
          if (info.trigger === 'After created a DareMe') {
            /*
              section: 'Create DareMe',
              trigger: 'After created a DareMe',
              dareme: updatedDareme,
            */
            if (info.sender === 'Admin' && info.recipient === 'Owner') {
              const admin : any= result[1];

              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: admin._id,
                receiverInfo: [{
                  receiver: user._id
                }],
                date: currentTime,
                dareme: data.dareme._id
              });

              notifications.push(newNotify.save());
              notifyUsers.push(user.email);
              setUserNotifyTrue.push(User.findByIdAndUpdate(user._id, { new_notification: true }));

            } else if (info.sender === 'Owner' && info.recipient === 'User') {
              let rInfo: Array<any> = [];

              user.subscribed_users.forEach((sUser: any) => {
                rInfo.push({ receiver: sUser });
                setUserNotifyTrue.push(User.findByIdAndUpdate(sUser, { new_notification: true }));
              });

              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: user._id,
                receiverInfo: rInfo,
                date: currentTime,
                dareme: data.dareme._id
              });

              let users: Array<any> = [];

              for (const userTemp of user.subscribed_users) users.push(User.findById(userTemp));
              let userResult = await Promise.all(users);

              notifications.push(newNotify.save());
              for (const nuser of userResult) notifyUsers.push(nuser.email);
            }
          }
        }
        index++;
      }
      Promise.all(setUserNotifyTrue);
      Promise.all(notifications);
      for (const notify of notifyUsers) io.to(notify).emit('create_notification')
    } else if (data.section === 'Create FundMe') {
      var index = 0;
      const result = await Promise.all([
        User.findById(data.fundme.owner),
        User.findOne({ role: 'ADMIN' })
      ]);
      const user: any = result[0];

      for (const info of type.info) {
        if (info.auto && info.trigger === data.trigger) {
          if (info.trigger === 'After created a FundMe') {
            /*
              section: 'Create FundMe',
              trigger: 'After created a FundMe',
              dareme: updatedFundme,
            */
            if (info.sender === 'Admin' && info.recipient === 'Owner') {
              const admin: any = result[1];

              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: admin._id,
                receiverInfo: [{
                  receiver: user._id
                }],
                date: currentTime,
                fundme: data.fundme._id
              });

              notifications.push(newNotify.save());
              notifyUsers.push(user.email);
              setUserNotifyTrue.push(User.findByIdAndUpdate(user._id, { new_notification: true }));

            } else if (info.sender === 'Owner' && info.recipient === 'User') {
              let rInfo: Array<any> = [];

              user.subscribed_users.forEach((sUser: any) => {
                rInfo.push({ receiver: sUser });
                setUserNotifyTrue.push(User.findByIdAndUpdate(sUser, { new_notification: true }));
              });

              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: user._id,
                receiverInfo: rInfo,
                date: currentTime,
                fundme: data.fundme._id
              });

              let users: Array<any> = [];

              for (const userTemp of user.subscribed_users) users.push(User.findById(userTemp));
              let userResult = await Promise.all(users);

              notifications.push(newNotify.save());
              for (const nuser of userResult) notifyUsers.push(nuser.email);
            }

            Promise.all(setUserNotifyTrue);
            Promise.all(notifications);
            for (const notify of notifyUsers) io.to(notify).emit('create_notification');
          }
        }
        index++;
      }
    } else if (data.section === 'Ongoing DareMe') {
      var index = 0;
      const result = await Promise.all([
        User.findById(data.dareme.owner._id),
        User.findOne({ role: 'ADMIN' })
      ]);
      const user: any = result[0];

      for (const info of type.info) {
        if (info.auto && info.trigger === data.trigger) {
          if (info.trigger === 'After voter voted in DareMe (non-Superfans)') {
            /*
              section: 'Ongoing DareMe',
              trigger: 'After voter voted in DareMe (non-Superfans)',
              dareme: updatedDareme,
            */
            if (info.sender === 'Voter' && info.recipient === 'Owner') {
              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: data.voterId,
                receiverInfo: [{
                  receiver: user._id
                }],
                date: currentTime,
                dareme: data.dareme._id,
                option: data.option._id,
                donuts: data.donuts,
              });

              notifications.push(newNotify.save());
              notifyUsers.push(user.email);
              setUserNotifyTrue.push(User.findByIdAndUpdate(user._id, { new_notification: true }));
            }

            Promise.all(setUserNotifyTrue);
            Promise.all(notifications);
            io.to(user.email).emit('create_notification');

          } else if (info.trigger === 'After voter voted in DareMe (Superfans)') {
            /*
              section: 'Ongoing DareMe',
              trigger: 'After voter voted in DareMe (Superfans)',
              dareme: updatedDareme,
            */
            if (info.sender === 'Voter' && info.recipient === 'Owner') {
              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: data.voterId,
                receiverInfo: [{
                  receiver: user._id
                }],
                date: currentTime,
                dareme: data.dareme._id,
                option: data.option._id,
                donuts: data.donuts,
              });

              notifications.push(newNotify.save());
              notifyUsers.push(user.email)
              setUserNotifyTrue.push(User.findByIdAndUpdate(user._id, { new_notification: true }));
            }

            Promise.all(setUserNotifyTrue);
            Promise.all(notifications);
            io.to(user.email).emit('create_notification');
          }
        }
        index++;
      }
    } else if (data.section === 'Ongoing FundMe') {
      var index = 0;
      const result = await Promise.all([
        User.findById(data.fundme.owner._id),
        User.findOne({ role: 'ADMIN' })
      ]);
      const user: any = result[0];

      for (const info of type.info) {
        if (info.auto && info.trigger === data.trigger) {
          if (info.trigger === 'After voter voted in FundMe (non-Superfans)') {
            /*
              section: 'Ongoing FundMe',
              trigger: 'After voter voted in FunMe (non-Superfans)',
              fundme: updatedFundme,
            */
            if (info.sender === 'Voter' && info.recipient === 'Owner') {
              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: data.voterId,
                receiverInfo: [{
                  receiver: user._id
                }],
                date: currentTime,
                fundme: data.fundme._id,
                donuts: data.donuts,
              });

              notifications.push(newNotify.save());
              notifyUsers.push(user.email);
              setUserNotifyTrue.push(User.findByIdAndUpdate(user._id, { new_notification: true }));
            }

            Promise.all(setUserNotifyTrue);
            Promise.all(notifications);
            io.to(user.email).emit('create_notification');

          } else if (info.trigger === 'After voter voted in FundMe (Superfans)') {
            /*
              section: 'Ongoing FundMe',
              trigger: 'After voter voted in FundMe (Superfans)',
              fundme: updatedFundme,
            */
            if (info.sender === 'Voter' && info.recipient === 'Owner') {
              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: data.voterId,
                receiverInfo: [{
                  receiver: user._id
                }],
                date: currentTime,
                fundme: data.fundme._id,
                donuts: data.donuts,
              });

              notifications.push(newNotify.save());
              notifyUsers.push(user.email);
              setUserNotifyTrue.push(User.findByIdAndUpdate(user._id, { new_notification: true }));
            }

            Promise.all(setUserNotifyTrue);
            Promise.all(notifications);
            io.to(user.email).emit('create_notification');
          }
        }
        index++;
      }
    } else if (data.section === 'Finished DareMe') {
      index = 0
      const result = await Promise.all([
        User.findById(data.dareme.owner),
        User.findOne({ role: 'ADMIN' })
      ])

      for (const info of type.info) {
        if (info.auto && info.trigger === data.trigger) {
          if (info.trigger === 'After DareMe is finished') {
            /*
              section: 'Finished DareMe',
              trigger: 'After DareMe is Finished',
              dareme: updatedDareme,
            */
            if (info.sender === 'Admin' && info.recipient === 'Voter of Non Winning Dares') {
              const admin: any = result[1]
              let users: Array<any> = []

              data.voters.forEach((voter: any) => {
                const newNotify = new Notification({
                  section: type._id,
                  index: index,
                  sender: admin._id,
                  receiverInfo: [{ receiver: voter.userId }],
                  date: currentTime,
                  option: data.option.option._id,
                  dareme: data.dareme._id,
                  donuts: voter.donuts
                })
                notifications.push(newNotify.save())
                users.push(User.findById(voter.userId))
                setUserNotifyTrue.push(User.findByIdAndUpdate(voter.userId, { new_notification: true }));
              })

              let userResult = await Promise.all(users)
              for (const nuser of userResult) notifyUsers.push(nuser.email)
            }

            Promise.all(setUserNotifyTrue)
            Promise.all(notifications)
            for (const notify of notifyUsers) io.to(notify).emit('create_notification')
          }
        }
        index++
      }
    } else if (data.section === 'Tipping') {
      index = 0

      for (const info of type.info) {
        if (info.auto && info.trigger === data.trigger) {
          if (info.trigger === 'After make tipping sucessfully') {
            /*
              section: 'Tipping',
              trigger: 'After make tipping sucessfully',
              tip: tip,
            */
            if (info.sender === 'Admin' && info.recipient === 'User') {
              const admin: any = await User.findOne({ role: 'ADMIN' })
              let users: Array<any> = []

              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: admin._id,
                receiverInfo: [{ receiver: data.tip.tipper }],
                date: currentTime,
                tip: data.tip._id,
                donuts: data.tip.tip
              })
              notifications.push(newNotify.save())
              users.push(User.findById(data.tip.tipper))
              setUserNotifyTrue.push(User.findByIdAndUpdate(data.tip.tipper, { new_notification: true }));

              let userResult = await Promise.all(users)
              for (const nuser of userResult) notifyUsers.push(nuser.email)
            }
          } else if (info.trigger === 'After received Donuts from tipping') {
            if (info.sender === 'Admin' && info.recipient === 'Creator') {
              const admin: any = await User.findOne({ role: 'ADMIN' })
              let users: Array<any> = []

              const newNotify = new Notification({
                section: type._id,
                index: index,
                sender: admin._id,
                receiverInfo: [{ receiver: data.tip.user }],
                date: currentTime,
                tip: data.tip._id,
                donuts: data.tip.tip
              })
              notifications.push(newNotify.save())
              users.push(User.findById(data.tip.user))
              setUserNotifyTrue.push(User.findByIdAndUpdate(data.tip.user, { new_notification: true }));

              let userResult = await Promise.all(users)
              for (const nuser of userResult) notifyUsers.push(nuser.email)
            }
          }
        }
        index++
      }
      Promise.all(setUserNotifyTrue)
      Promise.all(notifications)
      for (const notify of notifyUsers) io.to(notify).emit('create_notification')
    }
  } catch (err) {
    console.log(err)
  }
}

export const getNotificationSetting = async (req: Request, res: Response) => {
  try {
    const setting = await NotificationSetting.findOne();
    return res.status(200).json({ success: true, setting: setting });
  } catch (err) {
    console.log(err);
  }
}

export const addNotificationSetting = async (req: Request, res: Response) => {
  try {
    const { value, type } = req.body;
    const setting = await NotificationSetting.findOne();
    if (type === 0) {
      let sections: any = [];
      if (setting && setting.section && setting.section.length > 0) sections = setting.section;
      sections.push({ title: value });
      if (setting === null) {
        const newSetting = new NotificationSetting({ section: sections, sender: [], recipient: [], trigger: [] });
        await newSetting.save();
      } else await NotificationSetting.findOneAndUpdate({}, { section: sections });
      return res.status(200).json({ success: true });
    } else if (type === 1) {
      let senders: any = [];
      if (setting && setting.sender && setting.sender.length > 0) senders = setting.sender;
      senders.push({ title: value });
      if (setting === null) {
        const newSetting = new NotificationSetting({ section: [], sender: senders, recipient: [], trigger: [] });
        await newSetting.save();
      } else await NotificationSetting.findOneAndUpdate({}, { sender: senders });
      return res.status(200).json({ success: true });
    } else if (type === 2) {
      let recipients: any = [];
      if (setting && setting.recipient && setting.recipient.length > 0) recipients = setting.recipient;
      recipients.push({ title: value });
      if (setting === null) {
        const newSetting = new NotificationSetting({ section: [], sender: [], recipient: recipients, trigger: [] });
        await newSetting.save();
      } else await NotificationSetting.findOneAndUpdate({}, { recipient: recipients });
      return res.status(200).json({ success: true });
    } else {
      let triggers: any = [];
      if (setting && setting.trigger && setting.trigger.length > 0) triggers = setting.trigger;
      triggers.push({ title: value });
      if (setting === null) {
        const newSetting = new NotificationSetting({ section: [], sender: [], recipient: [], trigger: triggers });
        await newSetting.save();
      } else await NotificationSetting.findOneAndUpdate({}, { trigger: triggers });
      return res.status(200).json({ success: true });
    }
  } catch (err) {
    console.log(err);
  }
}

export const addNotificationType = async (req: Request, res: Response) => {
  try {
    const { section, sender, receiver, trigger, mode, contentEn } = req.body;
    const notification = await NotificationType.findOne({ section: section });
    let newInfo = notification === null ? [] : notification.info;
    newInfo.push({
      sender: sender,
      recipient: receiver,
      trigger: trigger,
      auto: mode,
      contentEn: contentEn
    });
    if (notification === null) {
      const newType = new NotificationType({
        section: section,
        info: newInfo
      });

      await newType.save();
    } else await NotificationType.findByIdAndUpdate(notification._id, { info: newInfo });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export const getNotificationType = async (req: Request, res: Response) => {
  try {
    const types = await NotificationType.find();

    return res.status(200).json({ success: true, types: types });
  } catch (err) {
    console.log(err)
  }
}

export const setNotificationAuto = async (req: Request, res: Response) => {
  try {
    const { id, no, auto } = req.body;
    const type: any = await NotificationType.findById(id);
    let info = type.info;
    info[no].auto = auto;
    await NotificationType.findByIdAndUpdate(id, { info: info });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
} 