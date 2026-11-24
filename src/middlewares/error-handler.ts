import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";

// Les 4 paramètres sont obligatoires : c'est ce qui permet à Express de reconnaître un middleware d'erreurs
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
    } else if (err?.type === "entity.parse.failed") {
        res.status(400).json({ error: { code: "INVALID_JSON", message: "JSON mal formé" } });
    } else {
        console.error(err);
        res.status(500).json({ error: { code: "INTERNAL", message: "Erreur interne" } });
    }
}
