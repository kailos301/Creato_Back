import mongoose, { Schema } from 'mongoose';

const NotificationTypeSchema = new mongoose.Schema({
    section: {
        type: String
    },
    info: [{
        _id: false,
        sender: {
            type: String
        },
        recipient: {
            type: String
        },
        trigger: {
            type: String
        },
        contentEn: {
            type: String
        },
        contentCh: {
            type: String
        },
        auto: {
            type: Boolean
        }
    }]
});

export default mongoose.model('notificationtypes', NotificationTypeSchema);