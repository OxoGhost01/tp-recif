import type Database from "better-sqlite3";
import type { AdoptionFilters, AdoptionRequest, AdoptionStatus, NewAdoptionRequest } from "../models/adoption-request.js";

export interface AdoptionDao {
    findAll(filters?: AdoptionFilters): Promise<AdoptionRequest[]>;
    findById(id: number): Promise<AdoptionRequest | null>;
    findByFish(fishId: number): Promise<AdoptionRequest[]>;
    create(data: NewAdoptionRequest): Promise<AdoptionRequest>;
    setStatus(id: number, status: AdoptionStatus): Promise<void>;
    deleteByFish(fishId: number): Promise<void>;
}

type AdoptionRow = {
    id: number;
    fish_id: number;
    adopter_name: string;
    adopter_email: string;
    message: string;
    status: AdoptionStatus;
    created_at: string;
    decided_at: string | null;
};

const toAdoptionRequest = (row: AdoptionRow): AdoptionRequest => ({
    id: row.id,
    fishId: row.fish_id,
    adopterName: row.adopter_name,
    adopterEmail: row.adopter_email,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
});

export class SqliteAdoptionDao implements AdoptionDao {
    constructor(private readonly db: Database.Database) {}

    async findAll(filters: AdoptionFilters = {}): Promise<AdoptionRequest[]> {
        const rows = this.db
            .prepare(`SELECT * FROM adoption_requests
                WHERE (@status IS NULL OR status = @status)
                ORDER BY id`)
            .all({ status: filters.status ?? null }) as AdoptionRow[];
        return rows.map(toAdoptionRequest);
    }

    async findById(id: number): Promise<AdoptionRequest | null> {
        const row = this.db.prepare("SELECT * FROM adoption_requests WHERE id = ?").get(id) as AdoptionRow | undefined;
        return row ? toAdoptionRequest(row) : null;
    }

    async findByFish(fishId: number): Promise<AdoptionRequest[]> {
        const rows = this.db
            .prepare("SELECT * FROM adoption_requests WHERE fish_id = ? ORDER BY id")
            .all(fishId) as AdoptionRow[];
        return rows.map(toAdoptionRequest);
    }

    async create(data: NewAdoptionRequest): Promise<AdoptionRequest> {
        const info = this.db
            .prepare(`INSERT INTO adoption_requests (fish_id, adopter_name, adopter_email, message, status, created_at)
                VALUES (@fishId, @adopterName, @adopterEmail, @message, 'en_attente', @createdAt)`)
            .run({ ...data, createdAt: new Date().toISOString() });
        return (await this.findById(Number(info.lastInsertRowid)))!;
    }

    // Une décision (acceptee / refusee) est datée ; on ne repasse jamais en attente
    async setStatus(id: number, status: AdoptionStatus): Promise<void> {
        this.db
            .prepare("UPDATE adoption_requests SET status = ?, decided_at = ? WHERE id = ?")
            .run(status, status === "en_attente" ? null : new Date().toISOString(), id);
    }

    async deleteByFish(fishId: number): Promise<void> {
        this.db.prepare("DELETE FROM adoption_requests WHERE fish_id = ?").run(fishId);
    }
}
