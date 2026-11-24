import express, { type Request, type Response } from "express";
import { buildWhere } from "./utils/query-helper.js";
import { db } from "./data/db.js";
import { isAdminApiKey, parseId } from "./schemas/common.js";
import { validate } from "./schemas/validation.js";
import { fishSchema } from "./schemas/fish.schema.js";
import { adoptionSchema } from "./schemas/adoption.schema.js";

// Renvoie false (et répond 401) si la clé d'API est absente ou fausse
function requireAdmin(req: Request, res: Response): boolean {
  if (isAdminApiKey(req.get("X-Api-Key"))) return true;
  res.status(401).json({ message: "Non autorisé" });
  return false;
}

// Renvoie l'identifiant, ou null (et répond 400) s'il est invalide
function idOrReject(req: Request, res: Response): number | null {
  const id = parseId(req.params.id);
  if (id === null) res.status(400).json({ message: "Identifiant invalide" });
  return id;
}

// Accepter et refuser une demande : même logique, seule la décision change
const FISH_STATUS_AFTER = { acceptee: "adopte", refusee: "disponible" } as const;

function decideAdoption(decision: keyof typeof FISH_STATUS_AFTER) {
  return (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const id = idOrReject(req, res);
    if (id === null) return;
    const request: any = db.prepare("SELECT * FROM adoption_requests WHERE id = ?").get(id);
    if (!request) {
      res.status(404).json({ message: "Demande introuvable" });
      return;
    }
    if (request.status !== "en_attente") {
      res.status(409).json({ message: "Demande déjà traitée" });
      return;
    }
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

  // ---------------------------------------------------------------- POISSONS

  // Liste des poissons, avec filtres ?species= et ?status=
  app.get("/fish", (req, res) => {
    try {
      const filters: any = {};
      if (req.query.species) filters.species = { op: "eq", value: req.query.species };
      if (req.query.status) filters.status = { op: "eq", value: req.query.status };
      const rows = db.prepare("SELECT * FROM fish " + buildWhere(filters) + " ORDER BY id").all();
      res.status(200).json(rows);
    } catch (e) {
      console.log(e);
      res.status(500).send("Erreur");
    }
  });

  // Détail d'un poisson, avec ses demandes d'adoption
  app.get("/fish/:id", (req, res) => {
    const id = idOrReject(req, res);
    if (id === null) return;
    const fish: any = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    if (!fish) {
      res.status(404).send("Poisson introuvable");
      return;
    }
    fish.requests = db.prepare("SELECT * FROM adoption_requests WHERE fish_id = ?").all(id);
    res.status(200).json(fish);
  });

  // Ajout d'un poisson (équipe du Récif)
  app.post("/fish", express.json(), (req, res) => {
    if (!requireAdmin(req, res)) return;
    const result = validate<Record<string, any>>(fishSchema, req.body);
    if (!result.ok) {
      res.status(400).json({ message: "Données invalides", errors: result.errors });
      return;
    }
    const b = result.data;
    const info = db
      .prepare(
        "INSERT INTO fish (name, species, breed, birth_date, description, internal_notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'disponible', ?)",
      )
      .run(b.name, b.species, b.breed || null, b.birthDate || null, b.description || "", b.internalNotes || "", new Date().toISOString());
    const fish = db.prepare("SELECT * FROM fish WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(fish);
  });

  // Modification d'un poisson (équipe du Récif)
  app.put("/fish/:id", express.json(), (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = idOrReject(req, res);
    if (id === null) return;
    const result = validate<Record<string, any>>(fishSchema, req.body, { partial: true });
    if (!result.ok) {
      res.status(400).json({ message: "Données invalides", errors: result.errors });
      return;
    }
    const existing = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ message: "Poisson introuvable" });
      return;
    }
    // Colonnes construites depuis les champs validés (donc ceux du schéma), jamais depuis req.body
    const fields = Object.keys(result.data);
    if (fields.length > 0) {
      const sets = fields.map((f) => `${toColumn(f)} = ?`).join(", ");
      db.prepare(`UPDATE fish SET ${sets} WHERE id = ?`).run(...fields.map((f) => result.data[f]), id);
    }
    const fish = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    res.status(200).json(fish);
  });

  // Suppression d'un poisson (équipe du Récif)
  app.delete("/fish/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = idOrReject(req, res);
    if (id === null) return;
    const fish = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    if (!fish) {
      res.status(404).json({ message: "Poisson introuvable" });
      return;
    }
    db.prepare("DELETE FROM adoption_requests WHERE fish_id = ?").run(id);
    db.prepare("DELETE FROM fish WHERE id = ?").run(id);
    res.status(204).end();
  });

  // ---------------------------------------------------------------- ADOPTIONS

  // Demande d'adoption (public)
  app.post("/fish/:id/adoptions", express.json(), (req, res) => {
    const id = idOrReject(req, res);
    if (id === null) return;
    const result = validate<Record<string, any>>(adoptionSchema, req.body);
    if (!result.ok) {
      res.status(400).json({ message: "Données invalides", errors: result.errors });
      return;
    }
    const b = result.data;
    const fish: any = db.prepare("SELECT * FROM fish WHERE id = ?").get(id);
    if (!fish) {
      res.status(404).json({ message: "Poisson introuvable" });
      return;
    }
    if (fish.status !== "disponible") {
      res.status(409).json({ message: "Ce poisson n'est plus disponible" });
      return;
    }
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
  app.get("/adoptions", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const filters: any = {};
    if (req.query.status) filters.status = { op: "eq", value: req.query.status };
    const rows = db.prepare("SELECT * FROM adoption_requests " + buildWhere(filters) + " ORDER BY id").all();
    res.status(200).json(rows);
  });

  // Accepter / refuser une demande (équipe du Récif)
  app.post("/adoptions/:id/accept", decideAdoption("acceptee"));
  app.post("/adoptions/:id/refuse", decideAdoption("refusee"));

  return app;
}
