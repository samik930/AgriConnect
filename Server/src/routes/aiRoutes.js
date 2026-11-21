import express from "express";
import { CropSuggestion, farmingAssistant, orchestrateQuery } from "../controllers/aiController.js";
import { optionalProtect } from "../middleware/auth.js";
import { aiRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Apply optional auth & rate limiting guardrails to all AI endpoints
router.use(optionalProtect);
router.use(aiRateLimiter);

router.post("/assistant", farmingAssistant);
router.post("/crop_suggestion", CropSuggestion);
router.post("/orchestrator", orchestrateQuery);

export default router;
