import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { config } from "../config.js";

export function requireApiKey(req: Request, _res: Response, next: NextFunction) {
    if (req.get("X-Api-Key") !== config.adminApiKey) {
        return next(new AppError(401, "UNAUTHORIZED", "Clé d'API manquante ou invalide"));
    }
    next();
}
