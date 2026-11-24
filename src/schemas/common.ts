import { config } from "../config.js";

// Identifiant valide : entier strictement positif ("abc", "0", "1.5" → null)
export function parseId(raw: unknown): number | null {
    if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null;
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function isAdminApiKey(key: unknown): boolean {
    return typeof key === "string" && key === config.adminApiKey;
}
