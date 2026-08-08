import express from "express";
import {
    addTechnology,
    showAllTechs,
    getTechById,
    updateTechnology,
    deleteTechnology
} from "../controllers/technologyController.js";

import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

const router = express.Router();

router.post("/",protect,authorize("admin"),addTechnology);
router.get("/",showAllTechs);
router.get("/:id",getTechById);
router.put("/:id",protect,authorize("admin"),updateTechnology);
router.delete("/:id",protect,authorize("admin"),deleteTechnology);

export default router;


