import type Database from "better-sqlite3";
import type { Fish, FishChanges, FishFilters, FishStatus, NewFish } from "../models/fish.js";

export interface FishDao {
    findAll(filters?: FishFilters): Promise<Fish[]>;
    findById(id: number): Promise<Fish | null>;
    create(data: NewFish): Promise<Fish>;
    update(id: number, changes: FishChanges): Promise<Fish | null>;
    delete(id: number): Promise<boolean>; // + ses demandes d'adoption
}

type FishRow = {
    id: number;
    name: string;
    species: Fish["species"];
    breed: string | null;
    birth_date: string | null;
    description: string;
    internal_notes: string;
    status: FishStatus;
    created_at: string;
};

const toFish = (row: FishRow): Fish => ({
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    birthDate: row.birth_date,
    description: row.description,
    internalNotes: row.internal_notes,
    status: row.status,
    createdAt: row.created_at,
});

// Liste blanche : champ de l'API → colonne. Les clés reçues ne vont jamais dans le SQL.
const UPDATABLE_COLUMNS: Record<keyof FishChanges, string> = {
    name: "name",
    species: "species",
    breed: "breed",
    birthDate: "birth_date",
    description: "description",
    internalNotes: "internal_notes",
};

export class SqliteFishDao implements FishDao {
    constructor(private readonly db: Database.Database) {}

    async findAll(filters: FishFilters = {}): Promise<Fish[]> {
        const rows = this.db
            .prepare(`SELECT * FROM fish
                WHERE (@species IS NULL OR species = @species)
                  AND (@status IS NULL OR status = @status)
                ORDER BY id`)
            .all({ species: filters.species ?? null, status: filters.status ?? null }) as FishRow[];
        return rows.map(toFish);
    }

    async findById(id: number): Promise<Fish | null> {
        const row = this.db.prepare("SELECT * FROM fish WHERE id = ?").get(id) as FishRow | undefined;
        return row ? toFish(row) : null;
    }

    async create(data: NewFish): Promise<Fish> {
        const info = this.db
            .prepare(`INSERT INTO fish (name, species, breed, birth_date, description, internal_notes, status, created_at)
                VALUES (@name, @species, @breed, @birthDate, @description, @internalNotes, 'disponible', @createdAt)`)
            .run({ ...data, createdAt: new Date().toISOString() });
        return (await this.findById(Number(info.lastInsertRowid)))!;
    }

    async update(id: number, changes: FishChanges): Promise<Fish | null> {
        const fields = (Object.keys(UPDATABLE_COLUMNS) as (keyof FishChanges)[]).filter((f) => changes[f] !== undefined);
        if (fields.length > 0) {
            const sets = fields.map((f) => `${UPDATABLE_COLUMNS[f]} = ?`).join(", ");
            this.db.prepare(`UPDATE fish SET ${sets} WHERE id = ?`).run(...fields.map((f) => changes[f]), id);
        }
        return this.findById(id);
    }

    async delete(id: number): Promise<boolean> {
        const run = this.db.transaction(() => {
            this.db.prepare("DELETE FROM adoption_requests WHERE fish_id = ?").run(id);
            return this.db.prepare("DELETE FROM fish WHERE id = ?").run(id).changes > 0;
        });
        return run();
    }
}
