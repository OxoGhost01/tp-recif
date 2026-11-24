import { Router } from "express";
import type { FishController } from "../controllers/fish.controller.js";
import { requireApiKey } from "../middlewares/require-api-key.js";

export function fishRoutes(controller: FishController): Router {
    const router = Router();
    router.get("/fish", controller.list);
    router.get("/fish/:id", controller.getOne);
    router.post("/fish", requireApiKey, controller.create);
    router.put("/fish/:id", requireApiKey, controller.update);
    router.delete("/fish/:id", requireApiKey, controller.remove);
    return router;
}
