import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";

export function notFound(req: Request, _res: Response, next: NextFunction) {
    next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.originalUrl} introuvable`));
}
