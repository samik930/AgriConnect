import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },


    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product"
        },

        farmer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },

        quantity: Number,

        price: Number,

        subtotal : Number
      }
    ],

    totalAmount: {
      type: Number,
      required: true
    },

    deliveryAddress: {
      type: String,
      required: true
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending"
    },

    orderStatus: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Packed",
        "Delivered",
        "Cancelled"
      ],
      default: "Pending"
    }
  },
  {
    timestamps: true
  }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;