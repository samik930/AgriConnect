import express from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  getFarmerOrders,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
} from "../controllers/orderController.js";

import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = express.Router();

router.get("/farmer/orders", protect,authorize("farmer"), getFarmerOrders);
router.post("/", protect, authorize("customer"), createOrder);
router.get("/", protect,authorize("customer"),getOrders);
router.get("/:id", protect,authorize("customer"),getOrderById);
router.delete("/:id", protect,authorize("customer"),cancelOrder);
router.put("/:id/status", protect,authorize("farmer"),updateOrderStatus);
router.put("/:id/payment", protect,authorize("admin"),updatePaymentStatus);

export default router;