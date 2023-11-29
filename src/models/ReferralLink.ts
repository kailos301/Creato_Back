import mongoose, { Schema } from "mongoose"
import User from "./User"

const ReferralLink = new mongoose.Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: User
  },
  expected: {
    type: Number,
    default: 0
  },
  earned: {
    type: Number,
    default: 0
  },
  invitedUsers: [{
    _id: false,
    newUser: {
      type: Schema.Types.ObjectId,
      ref: User
    },
    reward: {
      type: Number
    },
    earned: {
      type: Boolean
    },
    date: {
      type: Date
    }
  }]
});

export default mongoose.model("referrallinks", ReferralLink);