import { ADOPTION_STATUSES, type AdoptionRequest } from "../models/adoption-request.js";
import { email, oneOf, optional, text, type Schema } from "./validation.js";

// Entrée : formulaire d'adoption
export const adoptionSchema: Schema = {
    adopterName: text(1, 80),
    adopterEmail: email,
    message: optional(text(0, 500)),
};

// Entrée : filtres de la query string
export const adoptionFiltersSchema: Schema = {
    status: optional(oneOf(ADOPTION_STATUSES)),
};

// Sortie : l'adoptant ne reçoit que l'essentiel ; le personnel voit la demande complète
export type AdoptionPublicDto = Pick<AdoptionRequest, "id" | "fishId" | "status" | "createdAt">;
export type AdoptionStaffDto = AdoptionRequest;

export const toAdoptionPublicDto = (r: AdoptionRequest): AdoptionPublicDto => ({
    id: r.id,
    fishId: r.fishId,
    status: r.status,
    createdAt: r.createdAt,
});

export const toAdoptionStaffDto = (r: AdoptionRequest): AdoptionStaffDto => ({
    ...toAdoptionPublicDto(r),
    adopterName: r.adopterName,
    adopterEmail: r.adopterEmail,
    message: r.message,
    decidedAt: r.decidedAt,
});
