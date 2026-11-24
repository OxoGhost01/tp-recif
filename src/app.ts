import express from "express";
import { db } from "./data/db.js";
import { SqliteFishDao } from "./data/fish.dao.js";
import { SqliteAdoptionDao } from "./data/adoption.dao.js";
import { FishService } from "./services/fish.service.js";
import { AdoptionService } from "./services/adoption.service.js";
import { FishController } from "./controllers/fish.controller.js";
import { AdoptionController } from "./controllers/adoption.controller.js";
import { fishRoutes } from "./routes/fish.routes.js";
import { adoptionRoutes } from "./routes/adoption.routes.js";
import { notFound } from "./middlewares/not-found.js";
import { errorHandler } from "./middlewares/error-handler.js";

// Racine de composition : DAO → services → contrôleurs → routes
export function createApp() {
  const fishDao = new SqliteFishDao(db);
  const adoptionDao = new SqliteAdoptionDao(db);

  const fishService = new FishService(fishDao);
  const adoptionService = new AdoptionService(adoptionDao, fishDao);

  const fishController = new FishController(fishService);
  const adoptionController = new AdoptionController(adoptionService);

  const app = express();
  app.use(express.json());
  app.use(fishRoutes(fishController));
  app.use(adoptionRoutes(adoptionController));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
