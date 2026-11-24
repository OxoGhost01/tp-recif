export const SPECIES = ["koi", "betta", "poisson-rouge", "guppy"] as const;
export const FISH_STATUSES = ["disponible", "reserve", "adopte"] as const;

export type Species = (typeof SPECIES)[number];
export type FishStatus = (typeof FISH_STATUSES)[number];

export type Fish = {
    id: number;
    name: string;
    species: Species;
    breed: string | null;
    birthDate: string | null;
    description: string;
    internalNotes: string;
    status: FishStatus;
    createdAt: string;
};

export type NewFish = {
    name: string;
    species: Species;
    breed: string | null;
    birthDate: string | null;
    description: string;
    internalNotes: string;
};

// Modification partielle : seuls les champs présents sont changés (jamais id, status, createdAt)
export type FishChanges = Partial<NewFish>;

export type FishFilters = { species?: string; status?: string };
