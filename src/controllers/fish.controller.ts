import type { RequestHandler } from "express";
import { fishFiltersSchema, fishSchema, toFishPublicDto, toFishStaffDto } from "../dto/fish.dto.js";
import { parseId } from "../dto/common.js";
import { parse } from "../dto/validation.js";
import type { FishFilters } from "../models/fish.js";
import type { FishInput, FishService } from "../services/fish.service.js";

export class FishController {
    constructor(private readonly fishes: FishService) {}

    list: RequestHandler = async (req, res) => {
        const filters = parse<FishFilters>(fishFiltersSchema, req.query);
        res.json((await this.fishes.list(filters)).map(toFishPublicDto));
    };

    getOne: RequestHandler = async (req, res) => {
        res.json(toFishPublicDto(await this.fishes.get(parseId(req.params.id))));
    };

    create: RequestHandler = async (req, res) => {
        const input = parse<FishInput>(fishSchema, req.body, { strict: true });
        res.status(201).json(toFishStaffDto(await this.fishes.create(input)));
    };

    update: RequestHandler = async (req, res) => {
        const id = parseId(req.params.id);
        const changes = parse<Partial<FishInput>>(fishSchema, req.body, { partial: true, strict: true });
        res.json(toFishStaffDto(await this.fishes.update(id, changes)));
    };

    remove: RequestHandler = async (req, res) => {
        await this.fishes.remove(parseId(req.params.id));
        res.status(204).end();
    };
}
