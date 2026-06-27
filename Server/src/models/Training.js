import mongoose from "mongoose";

const trainingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    organizer: {
      type: String,
      required: true
    },

    date: {
      type: Date,
      required: true
    },

    location: {
      type: String
    },

    registrationLink: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Training", trainingSchema);