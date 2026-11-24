import type { RequestHandler } from "express";
import { adoptionSchema } from "../schemas/adoption.schema.js";
import { parseId } from "../schemas/common.js";
import { parse } from "../schemas/validation.js";
import type { AdoptionInput, AdoptionService } from "../services/adoption.service.js";

export class AdoptionController {
    constructor(private readonly adoptions: AdoptionService) {}

    request: RequestHandler = async (req, res) => {
        const fishId = parseId(req.params.id);
        res.status(201).json(await this.adoptions.request(fishId, parse<AdoptionInput>(adoptionSchema, req.body)));
    };

    list: RequestHandler = async (req, res) => {
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        res.json(await this.adoptions.list({ status }));
    };

    accept: RequestHandler = async (req, res) => {
        res.json(await this.adoptions.accept(parseId(req.params.id)));
    };

    refuse: RequestHandler = async (req, res) => {
        res.json(await this.adoptions.refuse(parseId(req.params.id)));
    };
}
