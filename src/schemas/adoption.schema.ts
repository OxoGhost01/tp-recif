import { email, optional, text, type Schema } from "./validation.js";

export const adoptionSchema: Schema = {
    adopterName: text(1, 80),
    adopterEmail: email,
    message: optional(text(0, 500)),
};
