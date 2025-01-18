import mongoose, { Schema } from "mongoose";

const subsciptionSchema = new Schema(
  {
    Subsciber: {
      type: Schema.Types.ObjectId, //one who is subscribing
      ref: "User",
    },
    channel: {
      type: Schema.Types.ObjectId, //the one to whom subscriber is subscribing
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Subsciption = mongoose.model("Subsciption", subsciptionSchema);
