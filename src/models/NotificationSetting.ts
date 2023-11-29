import mongoose from 'mongoose';

const NotificationSettingSchema = new mongoose.Schema({
    section: [{
        _id: false,
        no: Number,
        title: String
    }],
    sender: [{
        _id: false,
        no: Number,
        title: String
    }],
    recipient: [{
        _id: false,
        no: Number,
        title: String
    }],
    trigger: [{
        _id: false,
        no: Number,
        title: String
    }]
});

export default mongoose.model('notificationsettings', NotificationSettingSchema);