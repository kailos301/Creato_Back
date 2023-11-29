import mongoose, { Schema } from 'mongoose'
import User from './User'

const OptionSchema = new mongoose.Schema({
    writer: {
        type: Schema.Types.ObjectId,
        ref: User
    },
    title: {
        type: String,
    },
    voters: {
        type: Number,
        default: 0
    },
    donuts: {
        type: Number,
        default: 0
    },
    requests: {
        type: Number
    },
    status: {
        type: Number, // 1 active, 0 wating, -1 decline
    },
    win: {
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
        }
    }],
    date: {
        type: Date,
        default: Date.now()
    }
});

export default mongoose.model("options", OptionSchema);