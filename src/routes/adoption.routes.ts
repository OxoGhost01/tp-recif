import { Router } from "express";
import type { AdoptionController } from "../controllers/adoption.controller.js";
import { requireApiKey } from "../middlewares/require-api-key.js";

export function adoptionRoutes(controller: AdoptionController): Router {
    const router = Router();
    router.post("/fish/:id/adoptions", controller.request);
    router.get("/adoptions", requireApiKey, controller.list);
    router.post("/adoptions/:id/accept", requireApiKey, controller.accept);
    router.post("/adoptions/:id/refuse", requireApiKey, controller.refuse);
    return router;
}
