import express from "express";

import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct
} from "../controllers/productController.js";

import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = express.Router();

router.get("/", getAllProducts);

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
  authorize("farmer"),
  deleteProduct
);

export default router;