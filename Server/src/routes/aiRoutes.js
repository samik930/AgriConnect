import express from "express";
import { CropSuggestion, farmingAssistant, orchestrateQuery } from "../controllers/aiController.js";

const router = express.Router();

router.post("/assistant", farmingAssistant);
router.post("/crop_suggestion", CropSuggestion);
router.post("/orchestrator", orchestrateQuery);

export default router;