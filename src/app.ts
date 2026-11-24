import express, { type Request, type Response } from "express";
import { db } from "./data/db.js";
import { SqliteFishDao, type FishDao } from "./data/fish.dao.js";
import { SqliteAdoptionDao, type AdoptionDao } from "./data/adoption.dao.js";
import { parseId } from "./schemas/common.js";
import { parse } from "./schemas/validation.js";
import { fishSchema } from "./schemas/fish.schema.js";
import { adoptionSchema } from "./schemas/adoption.schema.js";
import { AppError } from "./errors/app-error.js";
import { requireApiKey } from "./middlewares/require-api-key.js";
import { notFound } from "./middlewares/not-found.js";
import { errorHandler } from "./middlewares/error-handler.js";
import type { FishStatus } from "./models/fish.js";

// Accepter et refuser une demande : même logique, seule la décision change
const FISH_STATUS_AFTER = { acceptee: "adopte", refusee: "disponible" } as const satisfies Record<string, FishStatus>;

function decideAdoption(fishDao: FishDao, adoptionDao: AdoptionDao, decision: keyof typeof FISH_STATUS_AFTER) {
  return async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const request = await adoptionDao.findById(id);
    if (!request) throw new AppError(404, "NOT_FOUND", `Demande ${id} introuvable`);
    if (request.status !== "en_attente") throw new AppError(409, "CONFLICT", "Demande déjà traitée");
    await adoptionDao.setStatus(id, decision);
    await fishDao.updateStatus(request.fishId, FISH_STATUS_AFTER[decision]);
    console.log(`Demande ${id} ${decision}, il faudrait prévenir ${request.adopterEmail}`);
    res.status(200).json(await adoptionDao.findById(id));
  };
}

export function createApp() {
  const app = express();
  app.use(express.json());

  const fishDao = new SqliteFishDao(db);
  const adoptionDao = new SqliteAdoptionDao(db);

  // ---------------------------------------------------------------- POISSONS

  // Liste des poissons, avec filtres ?species= et ?status=
  app.get("/fish", async (req, res) => {
    const species = typeof req.query.species === "string" ? req.query.species : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.status(200).json(await fishDao.findAll({ species, status }));
  });

  // Détail d'un poisson, avec ses demandes d'adoption
  app.get("/fish/:id", async (req, res) => {
    const id = parseId(req.params.id);
    const fish = await fishDao.findById(id);
    if (!fish) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
    res.status(200).json({ ...fish, requests: await adoptionDao.findByFish(id) });
  });

  // Ajout d'un poisson (équipe du Récif)
  app.post("/fish", requireApiKey, async (req, res) => {
    const b = parse(fishSchema, req.body);
    const fish = await fishDao.create({
      name: b.name,
      species: b.species,
      breed: b.breed || null,
      birthDate: b.birthDate || null,
      description: b.description || "",
      internalNotes: b.internalNotes || "",
    });
    res.status(201).json(fish);
  });

  // Modification d'un poisson (équipe du Récif)
  app.put("/fish/:id", requireApiKey, async (req, res) => {
    const id = parseId(req.params.id);
    const changes = parse(fishSchema, req.body, { partial: true });
    // Colonnes NOT NULL : un null explicite devient la valeur vide
    if (changes.description === null) changes.description = "";
    if (changes.internalNotes === null) changes.internalNotes = "";
    const fish = await fishDao.update(id, changes);
    if (!fish) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
    res.status(200).json(fish);
  });

  // Suppression d'un poisson (équipe du Récif)
  app.delete("/fish/:id", requireApiKey, async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await fishDao.findById(id))) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
    await adoptionDao.deleteByFish(id);
    await fishDao.delete(id);
    res.status(204).end();
  });

  // ---------------------------------------------------------------- ADOPTIONS

  // Demande d'adoption (public)
  app.post("/fish/:id/adoptions", async (req, res) => {
    const id = parseId(req.params.id);
    const b = parse(adoptionSchema, req.body);
    const fish = await fishDao.findById(id);
    if (!fish) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
    if (fish.status !== "disponible") throw new AppError(409, "CONFLICT", "Ce poisson n'est plus disponible");
    const request = await adoptionDao.create({
      fishId: id,
      adopterName: b.adopterName,
      adopterEmail: b.adopterEmail,
      message: b.message || "",
    });
    await fishDao.updateStatus(id, "reserve");
    res.status(201).json(request);
  });

  // Liste des demandes (équipe du Récif), filtre ?status=
  app.get("/adoptions", requireApiKey, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.status(200).json(await adoptionDao.findAll({ status }));
  });

  // Accepter / refuser une demande (équipe du Récif)
  app.post("/adoptions/:id/accept", requireApiKey, decideAdoption(fishDao, adoptionDao, "acceptee"));
  app.post("/adoptions/:id/refuse", requireApiKey, decideAdoption(fishDao, adoptionDao, "refusee"));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
