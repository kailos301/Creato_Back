import monogoose, { Schema } from 'mongoose'
import User from './User'

const PaymentSchema = new monogoose.Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: User
    },
    stripe: {
        type: String
    },
    payoneer: {
        type: String
    }
});

export default monogoose.model("payments", PaymentSchema);