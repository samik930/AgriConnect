import express from "express";

import {
  createProduct,
  getAllProducts,
  getProductById,
  getNearbyProducts,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} from "../controllers/productController.js";

import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.get("/", getAllProducts);

router.get("/nearby", protect, getNearbyProducts);

router.get("/:id", getProductById);

// Standalone image upload route
router.post(
  "/upload-image",
  protect,
  authorize("farmer"),
  upload.single("image"),
  uploadProductImage
);

router.post(
  "/",
  protect,
  authorize("farmer"),
  upload.single("image"),
  createProduct
);

router.put(
  "/:id",
  protect,
  authorize("farmer"),
  upload.single("image"),
  updateProduct
);

router.delete(
  "/:id",
  protect,
  authorize("farmer", "admin"),
  deleteProduct
);

export default router;