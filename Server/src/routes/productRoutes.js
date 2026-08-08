import express from "express";

import {
  createProduct,
  getAllProducts,
  getProductById,
  getNearbyProducts,
  updateProduct,
  deleteProduct
} from "../controllers/productController.js";

import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = express.Router();

router.get("/", getAllProducts);

router.get("/nearby", protect, getNearbyProducts);

router.get("/:id", getProductById);

router.post(
  "/",
  protect,
  authorize("farmer"),
  createProduct
);

router.put(
  "/:id",
  protect,
  authorize("farmer"),
  updateProduct
);

router.delete(
  "/:id",
  protect,
  authorize("farmer", "admin"),
  deleteProduct
);

export default router;