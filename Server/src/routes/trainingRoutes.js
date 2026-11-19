import express from "express";
import {
  createTraining,
  getAllTrainings,
  getTrainingById,
  updateTraining,
  deleteTraining,
} from "../controllers/trainingController.js";
import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = express.Router();

router.post("/", protect, authorize("admin"), createTraining);
router.get("/", getAllTrainings);
router.get("/:id", getTrainingById);
router.put("/:id", protect, authorize("admin"), updateTraining);
router.delete("/:id", protect, authorize("admin"), deleteTraining);

export default router;

