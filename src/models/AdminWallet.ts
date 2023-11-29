import monogoose from 'mongoose';

const AdminWalletSchema = new monogoose.Schema({
    admin: {
        type: String
    },
    wallet: {
        type: Number,
        default: 1000
    },
    date: {
        type: Date,
    }
});

export default monogoose.model("adminwallets", AdminWalletSchema);