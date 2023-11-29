import { Request, Response } from 'express'
import Stripe from "stripe"
import User from '../models/User'
import AdminWallet from '../models/AdminWallet'
import AdminUserTransaction from '../models/AdminUserTransaction'
import Payment from '../models/Payment'

const stripe = new Stripe(
  `${process.env.STRIPE_SECRET_KEY}`,
  { apiVersion: '2020-08-27', typescript: true }
);

function calcTime() {
  var d = new Date();
  var utc = d.getTime();
  var nd = new Date(utc + (3600000 * 8));
  return nd;
}

export const connectStripe = async (req: Request, res: Response) => {
  try {
    const { auth, userId } = req.body
    const response: any = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code: auth,
    })

    if (response.error) {
      return res.status(200).json({ success: false })
    }

    const payment = await Payment.findOne({ owner: userId })

    if (payment) {
      await Payment.findByIdAndUpdate(payment._id, { stripe: response.stripe_user_id })
    } else {
      const newPayment = new Payment({
        owner: userId,
        stripe: response.stripe_user_id
      })

      await newPayment.save()
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.log(err)
  }
}

export const disconnectStripe = async (req: Request, res: Response) => {
  try {
    const { userId, clientId } = req.body
    const account: any = await Payment.findOne({ owner: userId })

    const response: any = await stripe.oauth.deauthorize({
      client_id: clientId,
      stripe_user_id: account.stripe,
    })

    if (response.error) {
      return res.status(200).json({ success: false })
    }

    await Payment.findOneAndUpdate({ owner: userId }, { stripe: null })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.log(err)
  }
}

export const getPaymentInfo = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body
    const payment = await Payment.findOne({ owner: userId })

    return res.status(200).json({ success: true, payment: payment })
  } catch (err) {
    console.log(err)
  }
}

export const buyDonuts = async (req: Request, res: Response) => {
  try {
    const { token, item, userId, stripeId, check } = req.body;
    let charge = { status: 'requested' };
    const user: any = await User.findById(userId);
    let amount = item.donutCount / 10 * (100 - item.discountedPercent) / 100 * 100;
    amount += amount * 0.034 + 30;
    amount = amount * item.rate

    let customer = null;
    if (stripeId) {
      await stripe.charges.create({
        amount: Number(Math.round(amount)),
        currency: item.currency,
        customer: stripeId,
        description: `Property: ${item.property}, DonutCount: ${item.donutCount}, DiscountedPercent: ${item.discountedPercent}`,
      }).then(result => {
        charge = result;
      }).catch(err => { return res.status(200).json({ error: true, msg: err.raw.message }) });
    } else {
      if (check) {
        customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          source: token.id
        });
        await User.findByIdAndUpdate(userId, { stripeID: customer.id });
      }

      if (customer) {
        await stripe.charges.create({
          amount: Number(Math.round(amount)),
          currency: item.currency,
          customer: customer.id,
          description: `Property: ${item.property}, DonutCount: ${item.donutCount}, DiscountedPercent: ${item.discountedPercent}`,
        }).then(result => {
          charge = result;
        }).catch(err => { return res.status(200).json({ error: true, msg: err.raw.message }) });
      } else {
        await stripe.charges.create({
          amount: Number(Math.round(amount)),
          currency: item.currency,
          source: token.id,
          description: `Property: ${item.property}, DonutCount: ${item.donutCount}, DiscountedPercent: ${item.discountedPercent}`,
        }).then(result => {
          charge = result;
        }).catch(err => { return res.status(200).json({ error: true, msg: err.raw.message }) });
      }
    }

    if (charge.status === 'succeeded') {
      const wallet = user.wallet + item.donutCount;
      const result = await Promise.all([
        User.findByIdAndUpdate(user.id, { wallet: wallet }, { new: true }),
        AdminWallet.findOne({ admin: "ADMIN" }),
      ]);
      const updatedUser: any = result[0];
      const adminWallet: any = result[1];
      const adminDonuts = adminWallet.wallet - item.donutCount;

      const transaction = new AdminUserTransaction({
        description: 2,
        from: "ADMIN",
        to: "USER",
        user: userId,
        donuts: item.donutCount,
        date: calcTime()
      });

      await Promise.all([
        transaction.save(),
        AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminDonuts }),
      ]);
      req.body.io.to(user.email).emit("wallet_change", wallet);
      req.body.io.to("ADMIN").emit("wallet_change", adminDonuts);

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
      return res.status(200).json({ success: true, user: payload });
    } else return res.status(200).json({ success: true, result: charge })
  } catch (err) {
    return res.status(200).json({ error: true, msg: 'Payment is failed!' });
  }
}


export const getStripeID = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body
    const user: any = await User.findById(userId)
    let cardNum = null
    if (user.stripeID) {
      const customer: any = await stripe.customers.retrieve(user.stripeID)
      if (customer) {
        const card: any = await stripe.customers.retrieveSource(user.stripeID, customer?.default_source)
        cardNum = card?.last4
      }
    }
    return res.status(200).json({ success: true, stripeID: user.stripeID ? user.stripeID : null, cardNum: cardNum })
  } catch (err) {
    console.log(err)
  }
}

export const stripePayout = async (req: Request, res: Response) => {
  try {
    const { donuts, userId } = req.body
    const paymentAcount = await Payment.findOne({ owner: userId })
    
    // const transfer: any = await stripe.transfers.create({
    //   amount: 10,
    //   currency: 'hkd',
    //   destination: paymentAcount.stripe,
    // });

    // const result = await stripe.balance.retrieve()
    // console.log(result)
    const payout = await stripe.payouts.create({amount: 500, currency: 'usd'});
    
    // console.log(payout)
    // if(transfer.id) {
    //   return res.status(200).json({ success: true })
    // } else {
    //   return res.status(200).json({ success: false, message: transfer?.raw.message })
    // }
  } catch (err) {
    console.log(err)
  }
}