import type { RequestHandler } from "express";
import { adoptionFiltersSchema, adoptionSchema, toAdoptionPublicDto, toAdoptionStaffDto } from "../dto/adoption.dto.js";
import { parseId } from "../dto/common.js";
import { parse } from "../dto/validation.js";
import type { AdoptionFilters } from "../models/adoption-request.js";
import type { AdoptionInput, AdoptionService } from "../services/adoption.service.js";

export class AdoptionController {
    constructor(private readonly adoptions: AdoptionService) {}

    request: RequestHandler = async (req, res) => {
        const fishId = parseId(req.params.id);
        const input = parse<AdoptionInput>(adoptionSchema, req.body, { strict: true });
        res.status(201).json(toAdoptionPublicDto(await this.adoptions.request(fishId, input)));
    };

    list: RequestHandler = async (req, res) => {
        const filters = parse<AdoptionFilters>(adoptionFiltersSchema, req.query);
        res.json((await this.adoptions.list(filters)).map(toAdoptionStaffDto));
    };

    accept: RequestHandler = async (req, res) => {
        res.json(toAdoptionStaffDto(await this.adoptions.accept(parseId(req.params.id))));
    };

    refuse: RequestHandler = async (req, res) => {
        res.json(toAdoptionStaffDto(await this.adoptions.refuse(parseId(req.params.id))));
    };
}
