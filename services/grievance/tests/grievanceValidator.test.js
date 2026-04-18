"use strict";
/**
 * TDD — Phase H3.8: src/validators/grievanceValidator.js
 * Joi schema validation for create and status-update payloads.
 */
const { createSchema, statusSchema } = require("../src/validators/grievanceValidator");

const VALID_PLATFORM_ID = "550e8400-e29b-41d4-a716-446655440000";

const VALID_CREATE = {
    platform_id: VALID_PLATFORM_ID,
    category: "commission_change",
    description: "My commission rate was raised without notice",
    is_anonymous: true,
};

describe("createSchema — valid input", () => {
    test("valid body passes validation", () => {
        const { error } = createSchema.validate(VALID_CREATE);
        expect(error).toBeUndefined();
    });

    test("is_anonymous defaults to true when omitted", () => {
        const { value } = createSchema.validate({
            platform_id: VALID_PLATFORM_ID,
            category: "commission_change",
            description: "My commission was raised without notice",
        });
        expect(value.is_anonymous).toBe(true);
    });
});

describe("createSchema — invalid input", () => {
    test("missing platform_id → error", () => {
        const { error } = createSchema.validate({
            category: "commission_change",
            description: "My commission was raised without notice",
        });
        expect(error).toBeDefined();
    });

    test("non-uuid platform_id → error", () => {
        const { error } = createSchema.validate({
            ...VALID_CREATE,
            platform_id: "not-a-uuid",
        });
        expect(error).toBeDefined();
    });

    test("missing category → error", () => {
        const { error } = createSchema.validate({
            platform_id: VALID_PLATFORM_ID,
            description: "My commission was raised without notice",
        });
        expect(error).toBeDefined();
    });

    test("invalid category → error", () => {
        const { error } = createSchema.validate({
            ...VALID_CREATE,
            category: "wrong_category",
        });
        expect(error).toBeDefined();
    });

    test("all six valid categories are accepted", () => {
        const validCategories = [
            "commission_change",
            "deactivation",
            "payment_delay",
            "unfair_rating",
            "safety",
            "other",
        ];
        for (const category of validCategories) {
            const { error } = createSchema.validate({ ...VALID_CREATE, category });
            expect(error).toBeUndefined();
        }
    });

    test("missing description → error", () => {
        const { error } = createSchema.validate({
            platform_id: VALID_PLATFORM_ID,
            category: "commission_change",
        });
        expect(error).toBeDefined();
    });

    test("description under 10 chars → error", () => {
        const { error } = createSchema.validate({
            ...VALID_CREATE,
            description: "Short",
        });
        expect(error).toBeDefined();
    });

    test("description of exactly 10 chars passes", () => {
        const { error } = createSchema.validate({
            ...VALID_CREATE,
            description: "1234567890",
        });
        expect(error).toBeUndefined();
    });
});

describe("statusSchema — valid input", () => {
    test("status 'open' passes", () => {
        const { error } = statusSchema.validate({ status: "open" });
        expect(error).toBeUndefined();
    });

    test("status 'escalated' passes", () => {
        const { error } = statusSchema.validate({ status: "escalated" });
        expect(error).toBeUndefined();
    });

    test("status 'resolved' passes", () => {
        const { error } = statusSchema.validate({ status: "resolved" });
        expect(error).toBeUndefined();
    });

    test("optional resolution_notes is accepted", () => {
        const { error } = statusSchema.validate({
            status: "resolved",
            resolution_notes: "Issue addressed",
        });
        expect(error).toBeUndefined();
    });
});

describe("statusSchema — invalid input", () => {
    test("missing status → error", () => {
        const { error } = statusSchema.validate({});
        expect(error).toBeDefined();
    });

    test("invalid status value → error", () => {
        const { error } = statusSchema.validate({ status: "pending" });
        expect(error).toBeDefined();
    });
});
