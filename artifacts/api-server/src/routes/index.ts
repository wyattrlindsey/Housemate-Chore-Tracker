import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reminderRouter from "./reminders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reminderRouter);

export default router;
