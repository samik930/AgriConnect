import express from "express";
import {
  createMarketPrice,
  getAllMarketPrices,
  getMarketPriceById,
  updateMarketPrice,
  deleteMarketPrice,
} from "../controllers/marketPriceController.js";
import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = express.Router();

router.post("/", protect, authorize("admin"), createMarketPrice);
router.get("/", getAllMarketPrices);
router.get("/:id", getMarketPriceById);
router.put("/:id", protect, authorize("admin"), updateMarketPrice);
router.delete("/:id", protect, authorize("admin"), deleteMarketPrice);

export default router;

