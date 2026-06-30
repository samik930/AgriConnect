import mongoose from "mongoose";

const technologySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    state: {
      type: String,
      default: "All",
    },

    district: {
      type: String,
      default: null,
    },

    resourceLink: {
      type: String,
    },

    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Technology", technologySchema);