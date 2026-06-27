import mongoose from "mongoose";

const technologySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    image: {
      type: String
    },

    videoLink: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

const Technology = mongoose.model("Technology", technologySchema);

export default Technology;