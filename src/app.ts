import express, { type Request, type Response } from "express";
import { buildWhere } from "./utils/query-helper.js";
import { db } from "./data/db.js";
import { parseId } from "./schemas/common.js";
import { parse } from "./schemas/validation.js";
import { fishSchema } from "./schemas/fish.schema.js";
import { adoptionSchema } from "./schemas/adoption.schema.js";
import { AppError } from "./errors/app-error.js";
import { requireApiKey } from "./middlewares/require-api-key.js";
import { notFound } from "./middlewares/not-found.js";
import { errorHandler } from "./middlewares/error-handler.js";

// Accepter et refuser une demande : même logique, seule la décision change
const FISH_STATUS_AFTER = { acceptee: "adopte", refusee: "disponible" } as const;

function decideAdoption(decision: keyof typeof FISH_STATUS_AFTER) {
  return (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const request: any = db.prepare("SELECT * FROM adoption_requests WHERE id = ?").get(id);
    if (!request) throw new AppError(404, "NOT_FOUND", `Demande ${id} introuvable`);
    if (request.status !== "en_attente") throw new AppError(409, "CONFLICT", "Demande déjà traitée");
    db.prepare("UPDATE adoption_requests SET status = ?, decided_at = ? WHERE id = ?").run(decision, new Date().toISOString(), id);
    db.prepare("UPDATE fish SET status = ? WHERE id = ?").run(FISH_STATUS_AFTER[decision], request.fish_id);
    const updated = db.prepare("SELECT * FROM adoption_requests WHERE id = ?").get(id);
    console.log(`Demande ${id} ${decision}, il faudrait prévenir ${request.adopter_email}`);
    res.status(200).json(updated);
  };
}

// camelCase (API) → snake_case (colonnes)
const toColumn = (field: string) => field.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());

export function createApp() {
  const app = express();
  app.use(express.json());

  // ---------------------------------------------------------------- POISSONS

  // Liste des poissons, avec filtres ?species= et ?status=
  app.get("/fish", (req, res) => {
    const filters: any = {};
    if (req.query.species) filters.species = { op: "eq", value: req.query.species };
    if (req.query.status) filters.status = { op: "eq", value: req.query.status };
    const rows = db.prepare("SELECT * FROM fish " + buildWhere(filters) + " ORDER BY id").all();
    res.status(200).json(rows);
  });

  // Détail d'un poisson, avec ses demandes d'adoption
  app.get("/fish/:id", (req, res) => {
    const id = parseId(req.params.id);
    const fish: any = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    if (!fish) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
    fish.requests = db.prepare("SELECT * FROM adoption_requests WHERE fish_id = ?").all(id);
    res.status(200).json(fish);
  });

  // Ajout d'un poisson (équipe du Récif)
  app.post("/fish", requireApiKey, (req, res) => {
    const b = parse(fishSchema, req.body);
    const info = db
      .prepare(
        "INSERT INTO fish (name, species, breed, birth_date, description, internal_notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'disponible', ?)",
      )
      .run(b.name, b.species, b.breed || null, b.birthDate || null, b.description || "", b.internalNotes || "", new Date().toISOString());
    const fish = db.prepare("SELECT * FROM fish WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(fish);
  });

  // Modification d'un poisson (équipe du Récif)
  app.put("/fish/:id", requireApiKey, (req, res) => {
    const id = parseId(req.params.id);
    const data = parse(fishSchema, req.body, { partial: true });
    const existing = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    if (!existing) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
    // Colonnes construites depuis les champs validés (donc ceux du schéma), jamais depuis req.body
    const fields = Object.keys(data);
    if (fields.length > 0) {
      const sets = fields.map((f) => `${toColumn(f)} = ?`).join(", ");
      db.prepare(`UPDATE fish SET ${sets} WHERE id = ?`).run(...fields.map((f) => data[f]), id);
    }
    const fish = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    res.status(200).json(fish);
  });

  // Suppression d'un poisson (équipe du Récif)
  app.delete("/fish/:id", requireApiKey, (req, res) => {
    const id = parseId(req.params.id);
    const fish = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    if (!fish) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
    db.prepare("DELETE FROM adoption_requests WHERE fish_id = ?").run(id);
    db.prepare("DELETE FROM fish WHERE id = ?").run(id);
    res.status(204).end();
  });

  // ---------------------------------------------------------------- ADOPTIONS

  // Demande d'adoption (public)
  app.post("/fish/:id/adoptions", (req, res) => {
    const id = parseId(req.params.id);
    const b = parse(adoptionSchema, req.body);
    const fish: any = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    if (!fish) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
    if (fish.status !== "disponible") throw new AppError(409, "CONFLICT", "Ce poisson n'est plus disponible");
    const info = db
      .prepare(
        "INSERT INTO adoption_requests (fish_id, adopter_name, adopter_email, message, status, created_at) VALUES (?, ?, ?, ?, 'en_attente', ?)",
      )
      .run(id, b.adopterName, b.adopterEmail, b.message || "", new Date().toISOString());
    db.prepare("UPDATE fish SET status = 'reserve' WHERE id = ?").run(id);
    const request = db.prepare("SELECT * FROM adoption_requests WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(request);
  });

  // Liste des demandes (équipe du Récif), filtre ?status=
  app.get("/adoptions", requireApiKey, (req, res) => {
    const filters: any = {};
    if (req.query.status) filters.status = { op: "eq", value: req.query.status };
    const rows = db.prepare("SELECT * FROM adoption_requests " + buildWhere(filters) + " ORDER BY id").all();
    res.status(200).json(rows);
  });

  // Accepter / refuser une demande (équipe du Récif)
  app.post("/adoptions/:id/accept", requireApiKey, decideAdoption("acceptee"));
  app.post("/adoptions/:id/refuse", requireApiKey, decideAdoption("refusee"));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
