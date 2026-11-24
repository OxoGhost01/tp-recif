import type Database from "better-sqlite3";
import type { AdoptionFilters, AdoptionRequest, AdoptionStatus, NewAdoptionRequest } from "../models/adoption-request.js";

export interface AdoptionDao {
    findAll(filters?: AdoptionFilters): Promise<AdoptionRequest[]>;
    findById(id: number): Promise<AdoptionRequest | null>;
    findByFish(fishId: number): Promise<AdoptionRequest[]>;
    create(data: NewAdoptionRequest): Promise<AdoptionRequest>; // + poisson réservé
    accept(id: number): Promise<AdoptionRequest>;               // + poisson adopté
    refuse(id: number): Promise<AdoptionRequest>;               // + poisson à nouveau disponible
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
        return this.selectById(id);
    }

    async findByFish(fishId: number): Promise<AdoptionRequest[]> {
        const rows = this.db
            .prepare("SELECT * FROM adoption_requests WHERE fish_id = ? ORDER BY id")
            .all(fishId) as AdoptionRow[];
        return rows.map(toAdoptionRequest);
    }

    async create(data: NewAdoptionRequest): Promise<AdoptionRequest> {
        const run = this.db.transaction(() => {
            const info = this.db
                .prepare(`INSERT INTO adoption_requests (fish_id, adopter_name, adopter_email, message, status, created_at)
                    VALUES (@fishId, @adopterName, @adopterEmail, @message, 'en_attente', @createdAt)`)
                .run({ ...data, createdAt: new Date().toISOString() });
            this.db.prepare("UPDATE fish SET status = 'reserve' WHERE id = ?").run(data.fishId);
            return this.selectById(Number(info.lastInsertRowid))!;
        });
        return run();
    }

    async accept(id: number): Promise<AdoptionRequest> {
        return this.decide(id, "acceptee", "adopte");
    }

    async refuse(id: number): Promise<AdoptionRequest> {
        return this.decide(id, "refusee", "disponible");
    }

    // La décision et le nouveau statut du poisson réussissent ensemble, ou pas du tout
    private decide(id: number, status: AdoptionStatus, fishStatus: string): AdoptionRequest {
        const run = this.db.transaction(() => {
            this.db
                .prepare("UPDATE adoption_requests SET status = ?, decided_at = ? WHERE id = ?")
                .run(status, new Date().toISOString(), id);
            const request = this.selectById(id)!;
            this.db.prepare("UPDATE fish SET status = ? WHERE id = ?").run(fishStatus, request.fishId);
            return request;
        });
        return run();
    }

    private selectById(id: number): AdoptionRequest | null {
        const row = this.db.prepare("SELECT * FROM adoption_requests WHERE id = ?").get(id) as AdoptionRow | undefined;
        return row ? toAdoptionRequest(row) : null;
    }
}
