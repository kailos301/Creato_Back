import mongoose, { Schema } from "mongoose";

const GeneralSetting = new mongoose.Schema({
  referralLinkDonuts: {
    type: Number
  }
});

export default mongoose.model("generalsettings", GeneralSetting);