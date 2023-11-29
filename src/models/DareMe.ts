import monogoose, { Schema } from 'mongoose'
import User from './User'
import Option from './Option'

const DareMeSchema = new monogoose.Schema({
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
  options: [{
    _id: false,
    option: {
      type: Schema.Types.ObjectId,
      ref: Option
    }
  }],
  published: {
    type: Boolean,
    required: true
  },
  finished: {
    type: Boolean,
    default: false
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
    },
    transfer: {
      type: Boolean
    }
  }],
  wallet: {
    type: Number,
    default: 0
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
  reward: {
    type: Number
  },
  rewardText: {
    type: String
  },
  show: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now()
  }
});

export default monogoose.model("daremes", DareMeSchema);