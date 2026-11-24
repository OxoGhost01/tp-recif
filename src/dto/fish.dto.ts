import { FISH_STATUSES, SPECIES, type Fish } from "../models/fish.js";
import { isoDate, oneOf, optional, text, type Schema } from "./validation.js";

// Entrée : création (validate(fishSchema, body)) et modification (… { partial: true })
export const fishSchema: Schema = {
    name: text(1, 50),
    species: oneOf(SPECIES),
    breed: optional(text(0, 50)),
    birthDate: optional(isoDate),
    description: optional(text(0, 1000)),
    internalNotes: optional(text(0, 1000)),
};

// Entrée : filtres de la query string
export const fishFiltersSchema: Schema = {
    species: optional(oneOf(SPECIES)),
    status: optional(oneOf(FISH_STATUSES)),
};

// Sortie : chaque champ est choisi explicitement, une nouvelle colonne ne fuit jamais toute seule
export type FishPublicDto = Pick<Fish, "id" | "name" | "species" | "breed" | "birthDate" | "description" | "status">;
export type FishStaffDto = FishPublicDto & Pick<Fish, "internalNotes" | "createdAt">;

export const toFishPublicDto = (a: Fish): FishPublicDto => ({
    id: a.id,
    name: a.name,
    species: a.species,
    breed: a.breed,
    birthDate: a.birthDate,
    description: a.description,
    status: a.status,
});

export const toFishStaffDto = (a: Fish): FishStaffDto => ({
    ...toFishPublicDto(a),
    internalNotes: a.internalNotes,
    createdAt: a.createdAt,
});
