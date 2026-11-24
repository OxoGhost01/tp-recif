export const ADOPTION_STATUSES = ["en_attente", "acceptee", "refusee"] as const;

export type AdoptionStatus = (typeof ADOPTION_STATUSES)[number];

export type AdoptionRequest = {
    id: number;
    fishId: number;
    adopterName: string;
    adopterEmail: string;
    message: string;
    status: AdoptionStatus;
    createdAt: string;
    decidedAt: string | null;
};

export type NewAdoptionRequest = {
    fishId: number;
    adopterName: string;
    adopterEmail: string;
    message: string;
};

export type AdoptionFilters = { status?: string };
