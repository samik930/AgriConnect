import express from "express";

import {
  addToCart,
  getCart,
  removeFromCart
} from "../controllers/cartController.js";

import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = express.Router();

router.post(
  "/add",
  protect,
  authorize("customer"),
  addToCart
);

router.get(
  "/",
  protect,
  authorize("customer"),
  getCart
);

router.delete(
  "/remove/:productId",
  protect,
  authorize("customer"),
  removeFromCart
);

export default router;