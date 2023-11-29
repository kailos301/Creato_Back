import { Request, Response } from 'express';
import Stripe from "stripe";
import User from '../models/User';
import Tip from '../models/Tip';
import AdminWallet from '../models/AdminWallet';
import AdminUserTransaction from "../models/AdminUserTransaction";
import { addNewNotification } from '../controllers/notificationController'

function calcTime() {
    var d = new Date();
    var utc = d.getTime();
    var nd = new Date(utc + (3600000 * 8));
    return nd;
}

const stripe = new Stripe(
    `${process.env.STRIPE_SECRET_KEY}`,
    { apiVersion: '2020-08-27', typescript: true }
);

export const tipUser = async (req: Request, res: Response) => {
    try {
        const { type, tipper, user, tip, message } = req.body;

        if (type === 1) {
            const walletState: any = await Promise.all([
                User.findById(tipper),
                User.findById(user),
                AdminWallet.findOne({ admin: "ADMIN" })
            ]);

            const tipperWallet = walletState[0].wallet - tip;
            const receiverWallet = walletState[1].wallet + (tip * 95 / 100);
            const adminWallet = walletState[2].wallet + (tip * 5 / 100);

            const currentTime = calcTime();

            const newTip = new Tip({
                tipper: tipper,
                tip: tip,
                message: message,
                user: user,
                date: currentTime,
            });

            const newTransaction1 = new AdminUserTransaction({
                description: 8,
                from: 'USER',
                to: 'ADMIN',
                user: tipper,
                donuts: tip * 5 / 100,
                date: currentTime
            });

            const newTransaction2 = new AdminUserTransaction({
                description: 9,
                from: 'USER',
                to: 'USER',
                user: tipper,
                user1: user,
                donuts: tip * 95 / 100,
                date: currentTime
            });

            const updateState: any = await Promise.all([
                User.findByIdAndUpdate(tipper, { wallet: tipperWallet }, { new: true }),
                User.findByIdAndUpdate(user, { wallet: receiverWallet }, { new: true }),
                AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet }, { new: true }),
                newTip.save(),
                newTransaction1.save(),
                newTransaction2.save()
            ]);

            req.body.io.to(updateState[0].email).emit("wallet_change", updateState[0].wallet)
            req.body.io.to(updateState[1].email).emit("wallet_change", updateState[1].wallet)
            req.body.io.to("ADMIN").emit("wallet_change", updateState[2].wallet)

            addNewNotification(req.body.io, {
                section: 'Tipping',
                trigger: 'After make tipping sucessfully',
                tip: updateState[3]
            })

            addNewNotification(req.body.io, {
                section: 'Tipping',
                trigger: 'After received Donuts from tipping',
                tip: updateState[3]
            })

            const updateUser = updateState[0];
            const payload = {
                id: updateUser._id,
                name: updateUser.name,
                avatar: updateUser.avatar,
                role: updateUser.role,
                email: updateUser.email,
                wallet: updateUser.wallet,
                personalisedUrl: updateUser.personalisedUrl,
                language: updateUser.language,
                category: updateUser.categories,
                new_notification: updateUser.new_notification,
            };

            return res.status(200).json({ success: true, user: payload });
        } else {
            const walletState: any = await Promise.all([
                User.findById(user),
                AdminWallet.findOne({ admin: "ADMIN" })
            ]);

            const receiverWallet = walletState[0].wallet + (tip * 95 / 100);
            const adminWallet = walletState[1].wallet + (tip * 5 / 100);

            const currentTime = calcTime();

            const newTip = new Tip({
                nickname: tipper,
                tip: tip,
                message: message,
                user: user,
                date: currentTime
            });

            const newTransaction1 = new AdminUserTransaction({
                description: 8,
                from: 'USER',
                to: 'ADMIN',
                nickname: tipper,
                donuts: tip * 5 / 100,
                date: currentTime
            });

            const newTransaction2 = new AdminUserTransaction({
                description: 9,
                from: 'USER',
                to: 'USER',
                nickname: tipper,
                user1: user,
                donuts: tip * 95 / 100,
                date: currentTime
            });

            const updateState: any = await Promise.all([
                User.findByIdAndUpdate(user, { wallet: receiverWallet }, { new: true }),
                AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet }, { new: true }),
                newTip.save(),
                newTransaction1.save(),
                newTransaction2.save()
            ])

            req.body.io.to(updateState[0].email).emit("wallet_change", updateState[0].wallet)
            req.body.io.to("ADMIN").emit("wallet_change", updateState[1].wallet)

            addNewNotification(req.body.io, {
                section: 'Tipping',
                trigger: 'After received Donuts from tipping',
                tip: updateState[2]
            })

            return res.status(200).json({ success: true });
        }
    } catch (err) {
        console.log(err);
    }
}

export const buyDonutForTip = async (req: Request, res: Response) => {
    try {
        const { token, item, nickname } = req.body;
        let charge = { status: 'requested' };
        let amount = item.donutCount / 10 * (100 - item.discountedPercent) / 100 * 100;
        amount += amount * 0.034 + 30
        amount = amount * item.rate

        await stripe.charges.create({
            amount: Number(Math.round(amount)),
            currency: item.currency,
            source: token.id,
            description: `Property: ${item.property}, DonutCount: ${item.donutCount}, DiscountedPercent: ${item.discountedPercent}`,
        }).then(result => {
            charge = result;
        }).catch(err => {
            return res.status(200).json({ error: true, msg: err.raw.message })
        })

        if (charge.status === 'succeeded') {
            const adminWallet: any = await AdminWallet.findOne({ admin: "ADMIN" });
            const adminDonuts = adminWallet.wallet - item.donutCount;
            await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminDonuts });
            req.body.io.to("ADMIN").emit("wallet_change", adminDonuts);
            // const transaction = new AdminUserTransaction({
            //     description: 2,
            //     from: "ADMIN",
            //     to: "USER",
            //     user: userId,
            //     donuts: item.donutCount,
            //     date: calcTime()
            // });
            // await transaction.save();
            // const payload = {
            //     id: updatedUser._id,
            //     name: updatedUser.name,
            //     avatar: updatedUser.avatar,
            //     role: updatedUser.role,
            //     email: updatedUser.email,
            //     wallet: updatedUser.wallet,
            //     personalisedUrl: updatedUser.personalisedUrl,
            //     language: updatedUser.language,
            //     category: updatedUser.categories,
            //     new_notification: updatedUser.new_notification,
            // };
            return res.status(200).json({ success: true });
        } else return res.status(200).json({ success: true, result: charge })
    } catch (err) {
        return res.status(200).json({ error: true, msg: 'Payment is failed!' });
    }
}

export const getTipsData = async (req: Request, res: Response) => {
    try {
        const tips = await Tip.find().populate([{ path: 'tipper' }, { path: 'user' }]);
        const sortedTips = tips.sort((first: any, second: any) => {
            if (first.date > second.date) return 1;
            else if (first.date < second.date) return -1;
            return 0;
        });

        return res.status(200).json({ success: true, tips: sortedTips });
    } catch (err) {
        console.log(err);
    }
}

export const getTipProfile = async (req: Request, res: Response) => {
    try {
        const { url } = req.params;
        const user: any = await User.findOne({ personalisedUrl: url });
        const tips = await Tip.find({ user: user._id }).populate({ path: 'tipper' });
        const result = tips.sort((first: any, second: any) => {
            if (first.tip < second.tip) return 1;
            else if (first.tip > second.tip) return -1;
            else {
                if (first.date > second.date) return 1;
                else if (first.date < second.date) return -1;
                return 0;
            }
        });

        return res.status(200).json({ success: true, user: user, tips: result });
    } catch (err) {
        console.log(err)
    }
}

export const setTipFunction = async (req: Request, res: Response) => {
    try {
        const { tipValue, id } = req.body;
        const user = await User.findByIdAndUpdate(id, { tipFunction: tipValue }, { new: true });

        return res.status(200).json({ success: true, user: user });
    } catch (err) {
        console.log(err);
    }
}

export const changeVisible = async (req: Request, res: Response) => {
    try {
        const { show, tipId } = req.body;
        const tip: any = await Tip.findByIdAndUpdate(tipId, { show: show });
        const tips = await Tip.find({ user: tip.user }).populate({ path: 'tipper' });
        const result = tips.sort((first: any, second: any) => {
            if (first.tip < second.tip) return 1;
            else if (first.tip > second.tip) return -1;
            else {
                if (first.date > second.date) return 1;
                else if (first.date < second.date) return -1;
                return 0;
            }
        });

        return res.status(200).json({ success: true, tips: result });
    } catch (err) {
        console.log(err);
    }
}

export const getTipData = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const tip = await Tip.findById(id).populate({ path: 'tipper' });

        return res.status(200).json({ success: true, tip: tip });
    } catch (err) {
        console.log(err);
    }
}

export const updateTip = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { message, nickname, donuts } = req.body;
        let updateTip: any;
        if (nickname) updateTip = await Tip.findByIdAndUpdate(id, { message: message, nickname: nickname, tip: donuts }, { new: true }).populate({ path: 'tipper' });
        else updateTip = await Tip.findByIdAndUpdate(id, { message: message, tip: donuts }, { new: true }).populate({ path: 'tipper' });

        return res.status(200).json({ success: true, tip: updateTip });
    } catch (err) {
        console.log(err);
    }
}

export const deleteTip = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await Tip.findByIdAndDelete(id);

        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const getActiveTipUsers = async (req: Request, res: Response) => {
    try {
        const users = await User.find({ tipFunction: true });

        return res.status(200).json({ success: true, users: users });
    } catch (err) {
        console.log(err);
    }
}

export const setTipFunctionByUser = async (req: Request, res: Response) => {
    try {
        const { tipValue, userId } = req.body
        await User.findByIdAndUpdate(userId, { tipFunction: tipValue }, { new: true })
        return res.status(200).json({ success: true })
    } catch (err) {
        console.log(err)
    }
}