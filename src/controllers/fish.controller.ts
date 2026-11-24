import type { RequestHandler } from "express";
import { parseId } from "../schemas/common.js";
import { fishSchema } from "../schemas/fish.schema.js";
import { parse } from "../schemas/validation.js";
import type { AdoptionService } from "../services/adoption.service.js";
import type { FishService, FishInput } from "../services/fish.service.js";

const queryString = (value: unknown) => (typeof value === "string" ? value : undefined);

export class FishController {
    constructor(
        private readonly fishes: FishService,
        private readonly adoptions: AdoptionService,
    ) {}

    list: RequestHandler = async (req, res) => {
        res.json(await this.fishes.list({ species: queryString(req.query.species), status: queryString(req.query.status) }));
    };

    getOne: RequestHandler = async (req, res) => {
        const id = parseId(req.params.id);
        const fish = await this.fishes.get(id);
        res.json({ ...fish, requests: await this.adoptions.listByFish(id) });
    };

    create: RequestHandler = async (req, res) => {
        res.status(201).json(await this.fishes.create(parse<FishInput>(fishSchema, req.body)));
    };

    update: RequestHandler = async (req, res) => {
        const id = parseId(req.params.id);
        res.json(await this.fishes.update(id, parse<Partial<FishInput>>(fishSchema, req.body, { partial: true })));
    };

    remove: RequestHandler = async (req, res) => {
        await this.fishes.remove(parseId(req.params.id));
        res.status(204).end();
    };
}
