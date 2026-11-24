import type { FishDao } from "../data/fish.dao.js";
import { AppError } from "../errors/app-error.js";
import type { Fish, FishChanges, FishFilters, Species } from "../models/fish.js";

// Ce que le client peut envoyer : les champs facultatifs peuvent manquer ou valoir null
export type FishInput = {
    name: string;
    species: Species;
    breed?: string | null;
    birthDate?: string | null;
    description?: string | null;
    internalNotes?: string | null;
};

export class FishService {
    constructor(private readonly fishes: FishDao) {}

    list(filters: FishFilters = {}): Promise<Fish[]> {
        return this.fishes.findAll(filters);
    }

    async get(id: number): Promise<Fish> {
        const fish = await this.fishes.findById(id);
        if (!fish) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
        return fish;
    }

    create(input: FishInput): Promise<Fish> {
        return this.fishes.create({
            name: input.name,
            species: input.species,
            breed: input.breed || null,
            birthDate: input.birthDate || null,
            description: input.description || "",
            internalNotes: input.internalNotes || "",
        });
    }

    async update(id: number, changes: Partial<FishInput>): Promise<Fish> {
        // Colonnes NOT NULL : un null explicite devient la valeur vide
        const cleaned: FishChanges = {
            ...changes,
            description: changes.description === null ? "" : changes.description,
            internalNotes: changes.internalNotes === null ? "" : changes.internalNotes,
        };
        const fish = await this.fishes.update(id, cleaned);
        if (!fish) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
        return fish;
    }

    async remove(id: number): Promise<void> {
        if (!(await this.fishes.delete(id))) throw new AppError(404, "NOT_FOUND", `Poisson ${id} introuvable`);
    }
}
