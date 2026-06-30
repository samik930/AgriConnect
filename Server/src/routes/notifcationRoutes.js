import express from "express";
import protect from "../middleware/auth.js";
import authorize from "../middleware/role.js";

import {Notifyfarmers} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/",protect,authorize("farmer"),Notifyfarmers);

export default router;