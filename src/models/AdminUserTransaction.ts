import mongoose, { Schema } from "mongoose";
import User from "./User";
import DareMe from "./DareMe";
import FundMe from "./FundMe"

const AdminUserTransaction = new mongoose.Schema({
    description: {
        type: Number
    },
    from: {
        type: String
    },
    to: {
        type: String
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: User
    },
    user1: {
        type: Schema.Types.ObjectId,
        ref: User
    },
    nickname: {
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
    title: {
        type: String
    },
    donuts: {
        type: Number
    },
    date: {
        type: Date
    }
});

export default mongoose.model("adminusertransactions", AdminUserTransaction);