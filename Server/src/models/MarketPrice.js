import mongoose from "mongoose";

const marketPriceSchema = new mongoose.Schema(
  {
    cropName: {
      type: String,
      required: true
    },

    district: {
      type: String,
      required: true
    },

    marketPrice: {
      type: Number,
      required: true
    },

    unit: {
      type: String,
      default: "kg"
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  }
);

const MarketPrice = mongoose.model("MarketPrice", marketPriceSchema);

export default MarketPrice;