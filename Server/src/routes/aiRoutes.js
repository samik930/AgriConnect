import express from "express";
import { CropSuggestion, farmingAssistant } from "../controllers/aiController.js";

const router = express.Router();

router.post("/assistant", farmingAssistant);
router.post("/crop_suggestion",CropSuggestion)

export default router;