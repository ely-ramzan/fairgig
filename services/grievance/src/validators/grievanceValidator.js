"use strict";

const Joi = require("joi");

const VALID_CATEGORIES = ["commission_change", "deactivation", "payment_delay", "unfair_rating", "safety", "other"];
const VALID_STATUSES   = ["open", "escalated", "resolved"];

const createSchema = Joi.object({
    platform_id: Joi.string().uuid().required(),
    category: Joi.string().valid(...VALID_CATEGORIES).required(),
    description: Joi.string().min(10).required(),
    is_anonymous: Joi.boolean().default(true),
});

const statusSchema = Joi.object({
    status: Joi.string().valid(...VALID_STATUSES).required(),
    resolution_notes: Joi.string().optional(),
});

/** Validates GET /api/grievances query params */
const listQuerySchema = Joi.object({
    page:        Joi.number().integer().min(1).default(1),
    limit:       Joi.number().integer().min(1).max(100).default(20),
    platform_id: Joi.string().uuid().optional(),
    category:    Joi.string().valid(...VALID_CATEGORIES).optional(),
    status:      Joi.string().valid(...VALID_STATUSES).optional(),
    tag:         Joi.string().max(100).optional(),
});

/** Validates GET /api/grievances/clusters query params */
const clustersQuerySchema = Joi.object({
    days:             Joi.number().integer().min(1).max(365).default(30),
    min_cluster_size: Joi.number().integer().min(1).max(100).default(3),
});

module.exports = { createSchema, statusSchema, listQuerySchema, clustersQuerySchema };
