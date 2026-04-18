"use strict";
/**
 * TDD — Phase H4.3: POST/DELETE /api/grievances/:id/tags
 * Advocate-only tag management on existing grievances.
 */

const mockPrisma = {
    grievances: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn(),
    },
    grievance_tags: { create: jest.fn(), deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
};
jest.mock("@prisma/client", () => ({
    PrismaClient: jest.fn(() => mockPrisma),
}));

const axios = require("axios");
jest.mock("axios");

const request = require("supertest");
const app = require("../src/app");

const GRIEVANCE_ID  = "aaaaaaaa-0000-0000-0000-000000000001";
const WORKER_USER   = { user_id: "ww-0001", role: "worker",   city_zone_id: null };
const ADVOCATE_USER = { user_id: "aa-0001", role: "advocate", city_zone_id: null };
const AUTH_HEADER   = { Authorization: "Bearer fake-token" };

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────
// POST /api/grievances/:id/tags
// ─────────────────────────────────────────────────────
describe("POST /api/grievances/:id/tags", () => {
    const TAG_URL = `/api/grievances/${GRIEVANCE_ID}/tags`;

    test("no Authorization header returns 401", async () => {
        const resp = await request(app).post(TAG_URL).send({ tag: "commission_increase" });
        expect(resp.status).toBe(401);
    });

    test("worker role returns 403", async () => {
        axios.get.mockResolvedValue({ data: WORKER_USER });
        const resp = await request(app)
            .post(TAG_URL)
            .set(AUTH_HEADER)
            .send({ tag: "commission_increase" });
        expect(resp.status).toBe(403);
    });

    test("advocate with valid tag returns 201", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.grievance_tags.create.mockResolvedValue({
            id: "tag-uuid",
            grievance_id: GRIEVANCE_ID,
            tag: "commission_increase",
        });
        const resp = await request(app)
            .post(TAG_URL)
            .set(AUTH_HEADER)
            .send({ tag: "commission_increase" });
        expect(resp.status).toBe(201);
    });

    test("created tag is returned in response body", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.grievance_tags.create.mockResolvedValue({
            id: "tag-uuid",
            grievance_id: GRIEVANCE_ID,
            tag: "commission_increase",
        });
        const resp = await request(app)
            .post(TAG_URL)
            .set(AUTH_HEADER)
            .send({ tag: "commission_increase" });
        expect(resp.body).toHaveProperty("tag", "commission_increase");
    });

    test("missing tag field returns 400", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        const resp = await request(app)
            .post(TAG_URL)
            .set(AUTH_HEADER)
            .send({});
        expect(resp.status).toBe(400);
    });

    test("empty tag string returns 400", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        const resp = await request(app)
            .post(TAG_URL)
            .set(AUTH_HEADER)
            .send({ tag: "" });
        expect(resp.status).toBe(400);
    });

    test("duplicate tag (Prisma P2002) returns 409", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        const prismaError = new Error("Unique constraint failed");
        prismaError.code = "P2002";
        mockPrisma.grievance_tags.create.mockRejectedValue(prismaError);

        const resp = await request(app)
            .post(TAG_URL)
            .set(AUTH_HEADER)
            .send({ tag: "commission_increase" });
        expect(resp.status).toBe(409);
    });
});

// ─────────────────────────────────────────────────────
// DELETE /api/grievances/:id/tags/:tag
// ─────────────────────────────────────────────────────
describe("DELETE /api/grievances/:id/tags/:tag", () => {
    const DELETE_URL = `/api/grievances/${GRIEVANCE_ID}/tags/commission_increase`;

    test("no Authorization header returns 401", async () => {
        const resp = await request(app).delete(DELETE_URL);
        expect(resp.status).toBe(401);
    });

    test("worker role returns 403", async () => {
        axios.get.mockResolvedValue({ data: WORKER_USER });
        const resp = await request(app).delete(DELETE_URL).set(AUTH_HEADER);
        expect(resp.status).toBe(403);
    });

    test("advocate deleting tag returns 204", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.grievance_tags.deleteMany.mockResolvedValue({ count: 1 });
        const resp = await request(app).delete(DELETE_URL).set(AUTH_HEADER);
        expect(resp.status).toBe(204);
    });

    test("deleting non-existent tag still returns 204 (idempotent)", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.grievance_tags.deleteMany.mockResolvedValue({ count: 0 });
        const resp = await request(app).delete(DELETE_URL).set(AUTH_HEADER);
        expect(resp.status).toBe(204);
    });
});
