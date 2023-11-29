import mongoose, { Schema } from "mongoose";
import DareMe from "./DareMe";
import FundMe from "./FundMe"
import User from "./User";

const FanwallSchema = new mongoose.Schema({
  writer: {
    type: Schema.Types.ObjectId,
    ref: User
  },
  video: {
    type: String
  },
  embedUrl: {
    type: String
  },
  message: {
    type: String
  },
  dareme: {
    type: Schema.Types.ObjectId,
    ref: DareMe
  },
  fundme: {
    type: Schema.Types.ObjectId,
    ref: FundMe
  },
  posted: {
    type: Boolean
  },
  likes: [{
    _id: false,
    liker: {
      type: Schema.Types.ObjectId,
      ref: User
    }
  }],
  unlocks: [{
    _id: false,
    unlocker: {
      type: Schema.Types.ObjectId,
      ref: User
    }
  }],
  cover: {
    type: String
  },
  coverIndex: {
    type: Number
  },
  sizeType: {
    type: Boolean
  },
  date: {
    type: Date
  }
});

export default mongoose.model("fanwalls", FanwallSchema);