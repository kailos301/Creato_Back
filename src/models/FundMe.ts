import monogoose, { Schema } from 'mongoose';
import User from './User';

const FundMeSchema = new monogoose.Schema({
  owner: {
    type: Schema.Types.ObjectId,
    ref: User
  },
  title: {
    type: String,
  },
  deadline: {
    type: Number,
  },
  category: {
    type: Number,
  },
  teaser: {
    type: String,
  },
  reward: {
    type: Number,
  },
  rewardText: {
    type: String,
  },
  goal: {
    type: Number,
  },
  published: {
    type: Boolean,
    required: true
  },
  finished: {
    type: Boolean,
    default: false
  },
  wallet: {
    type: Number,
    default: 0
  },
  empty: {
    type: Boolean,
    default: false,
  },
  cover: {
    type: String
  },
  coverIndex: {
    type: Number
  },
  sizeType: {
    type: Boolean
  },
  show: {
    type: Boolean,
    default: true
  },
  voteInfo: [{
    _id: false,
    voter: {
      type: Schema.Types.ObjectId,
      ref: User
    },
    donuts: {
      type: Number,
      required: true
    },
    canFree: {
      type: Boolean,
      default: true
    },
    superfan: {
      type: Boolean
    }
  }],
  date: {
    type: Date,
    default: Date.now()
  }
});

export default monogoose.model("fundmes", FundMeSchema);