import { Request, Response } from "express";
import AdminWallet from "../models/AdminWallet";
import DareMe from "../models/DareMe";
import User from "../models/User";
import AdminUserTransaction from "../models/AdminUserTransaction";
import FundMe from "../models/FundMe";

function calcTime() {
    var d = new Date();
    var utc = d.getTime();
    var nd = new Date(utc + (3600000 * 8));
    return nd;
}

export const getTransactions = async (req: Request, res: Response) => {
    try {
        const { type } = req.params;
        const result = await Promise.all([
            AdminWallet.findOne({ admin: "ADMIN" }),
            User.find({ role: "USER" }),
            DareMe.find({}),
            FundMe.find({}),
            User.find({}).select({ 'name': 1, 'role': 1 }),
            Number(type) === 0 ?
                AdminUserTransaction.find({ $or: [{ from: 'ADMIN' }, { to: 'ADMIN' }, { description: 1 }] })
                    .populate([{ path: 'user' }, { path: 'user1' }, { path: 'dareme' }, { path: 'fundme' }])
                :
                AdminUserTransaction.find({ $or: [{ from: 'USER' }, { to: 'USER' }, { description: 3 }] })
                    .populate([{ path: 'user' }, { path: 'user1' }, { path: 'dareme' }, { path: 'fundme' }])
        ]);
        const adminWallet: any = result[0];
        const adminDonuts = adminWallet.wallet; //admin' s donuts
        const users: any = result[1];
        let userDonuts = 0.0;

        users.forEach((user: any) => {
            userDonuts += user.wallet;
        });

        const daremes = result[2];
        let daremeDonuts = 0.0;
        daremes.forEach((dareme: any) => {
            daremeDonuts += dareme.wallet;
        });
        const fundmes = result[3];
        let fundmeDonuts = 0.0;
        fundmes.forEach((fundme: any) => {
            fundmeDonuts = fundmeDonuts + fundme.empty ? 0 : fundme.wallet;
        })

        const resUsers = result[4];
        const transactions = result[5];

        return res.status(200).json({
            success: true,
            users: resUsers,
            transactions: transactions,
            adminDonuts: adminDonuts,
            userDonuts: userDonuts,
            daremeDonuts: daremeDonuts,
            fundmeDonuts: fundmeDonuts
        });
    } catch (err) {
        console.log(err);
    }
};

export const addAdminDonuts = async (req: Request, res: Response) => {
    try {
        const { donuts } = req.body;
        const adminWallets: any = await AdminWallet.findOne({ admin: 'ADMIN' });
        let wallet = Number(adminWallets.wallet) + Number(donuts);
        await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: wallet });
        const adminTransaction = new AdminUserTransaction({
            description: 1,
            donuts: donuts,
            date: calcTime()
        });
        await adminTransaction.save();
        req.body.io.to("ADMIN").emit("wallet_change", wallet);
        return res.status(200).json({ success: true, donuts: wallet });
    } catch (err) {
        console.log(err);
    }
};

export const transferDonuts = async (req: Request, res: Response) => {
    try {
        const { from, to, amount } = req.body;
        const result = await Promise.all([
            AdminWallet.findOne({ admin: 'ADMIN' }),
            User.findById(from),
            User.findById(to)
        ])
        const adminWallets: any = result[0]
        const fromUser: any = result[1]
        const toUser: any = result[2]
        if (fromUser.role === "ADMIN" && toUser.role === "ADMIN") return res.status(200).json({ success: false });
        let wallet = 0;
        if (fromUser.role === "ADMIN") {
            wallet = adminWallets.wallet - Number(amount);
            if (wallet < 0) return res.status(200).json({ success: false });
            await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: wallet });
            req.body.io.to("ADMIN").emit("wallet_change", wallet);
        } else {
            wallet = fromUser.wallet - Number(amount);
            if (wallet < 0) return res.status(200).json({ success: false });
            await User.findByIdAndUpdate(from, { wallet: wallet });
            req.body.io.to(fromUser.email).emit("wallet_change", wallet);
        }
        if (toUser.role === "ADMIN") {
            wallet = adminWallets.wallet + Number(amount);
            await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: wallet });
            req.body.io.to("ADMIN").emit("wallet_change", wallet);
        } else {
            wallet = toUser.wallet + Number(amount);
            await User.findByIdAndUpdate(to, { wallet: wallet });
            req.body.io.to(toUser.email).emit("wallet_change", wallet);
        }
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const getUserLatest5Transactions = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const transactions = await AdminUserTransaction.find({ user: userId }).sort({ date: -1 }).limit(5)
            .populate({ path: 'user' }).populate({ path: 'dareme' });
        return res.status(200).json({ success: true, transactions: transactions });
    } catch (err) {
        console.log(err);
    }
}

export const getUserTransactionsByDays = async (req: Request, res: Response) => {
    try {
        const { userId, days } = req.body;
        if (days === 30 || days === 60) {
            const toDate: any = new Date(calcTime());
            const fromDate: any = new Date((new Date(calcTime())).getTime() - days * 24 * 3600 * 1000);
            const transactions: any = await AdminUserTransaction.find({ user: userId })
                .where('date').gte(fromDate).lte(toDate)
                .populate({ path: 'user' }).populate({ path: 'dareme' });
            return res.status(200).json({ success: true, transactions: transactions });
        } else if (days === 0) {
            const transactions = await AdminUserTransaction.find({ user: userId })
                .populate({ path: 'user' }).populate({ path: 'dareme' });
            return res.status(200).json({ success: true, transactions: transactions });
        }
    } catch (err) {
        console.log(err);
    }
}