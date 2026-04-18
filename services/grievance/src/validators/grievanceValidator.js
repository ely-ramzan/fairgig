"use strict";

const Joi = require("joi");

const createSchema = Joi.object({
    platform_id: Joi.string().uuid().required(),
    category: Joi.string()
        .valid("commission_change", "deactivation", "payment_delay", "unfair_rating", "safety", "other")
        .required(),
    description: Joi.string().min(10).required(),
    is_anonymous: Joi.boolean().default(true),
});

const statusSchema = Joi.object({
    status: Joi.string().valid("open", "escalated", "resolved").required(),
    resolution_notes: Joi.string().optional(),
});

module.exports = { createSchema, statusSchema };
