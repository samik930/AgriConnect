import express from "express";
import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";

import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = express.Router();

router.post("/", protect, authorize("customer"), createReview);

router.get("/product/:productId", getProductReviews);

router.put("/:id", protect, authorize("customer"), updateReview);

router.delete("/:id", protect, authorize("customer"), deleteReview);

export default router;