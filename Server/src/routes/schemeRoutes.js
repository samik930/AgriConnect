import express from "express";
import {
  CreateScheme,
  getAllSchemes,
  getSchemeById,
  updateScheme,
  deleteScheme,
} from "../controllers/schemeController.js";

import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = express.Router();

router.post("/", protect, authorize("admin"), CreateScheme);
router.get("/", getAllSchemes);
router.get("/:id", getSchemeById);
router.put("/:id", protect, authorize("admin"), updateScheme);
router.delete("/:id", protect, authorize("admin"), deleteScheme);

export default router;
