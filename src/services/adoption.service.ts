import type { AdoptionDao } from "../data/adoption.dao.js";
import type { FishDao } from "../data/fish.dao.js";
import { AppError } from "../errors/app-error.js";
import type { AdoptionFilters, AdoptionRequest } from "../models/adoption-request.js";

export type AdoptionInput = {
    adopterName: string;
    adopterEmail: string;
    message?: string | null;
};

export class AdoptionService {
    constructor(
        private readonly adoptions: AdoptionDao,
        private readonly fishes: FishDao,
    ) {}

    list(filters: AdoptionFilters = {}): Promise<AdoptionRequest[]> {
        return this.adoptions.findAll(filters);
    }

    async request(fishId: number, input: AdoptionInput): Promise<AdoptionRequest> {
        const fish = await this.fishes.findById(fishId);
        if (!fish) throw new AppError(404, "NOT_FOUND", `Poisson ${fishId} introuvable`);
        if (fish.status !== "disponible") throw new AppError(409, "CONFLICT", "Ce poisson n'est plus disponible");
        return this.adoptions.create({
            fishId,
            adopterName: input.adopterName,
            adopterEmail: input.adopterEmail,
            message: input.message || "",
        });
    }

    async accept(id: number): Promise<AdoptionRequest> {
        await this.getPending(id);
        const decided = await this.adoptions.accept(id);
        console.log(`Demande ${id} ${decided.status}, il faudrait prévenir ${decided.adopterEmail}`);
        return decided;
    }

    async refuse(id: number): Promise<AdoptionRequest> {
        await this.getPending(id);
        const decided = await this.adoptions.refuse(id);
        console.log(`Demande ${id} ${decided.status}, il faudrait prévenir ${decided.adopterEmail}`);
        return decided;
    }

    private async getPending(id: number): Promise<AdoptionRequest> {
        const request = await this.adoptions.findById(id);
        if (!request) throw new AppError(404, "NOT_FOUND", `Demande ${id} introuvable`);
        if (request.status !== "en_attente") throw new AppError(409, "CONFLICT", "Demande déjà traitée");
        return request;
    }
}
