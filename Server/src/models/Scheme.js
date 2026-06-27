import mongoose from "mongoose";

const schemeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    eligibility: {
      type: String
    },

    link: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Scheme", schemeSchema);