import { AppError } from "../errors/app-error.js";

// Identifiant valide : entier strictement positif ("abc", "0", "1.5" → AppError 400)
export function parseId(raw: unknown): number {
    const id = typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new AppError(400, "VALIDATION_ERROR", "Identifiant invalide");
    }
    return id;
}
