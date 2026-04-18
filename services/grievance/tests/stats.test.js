"use strict";
/**
 * TDD — Phase H4.2: GET /api/grievances/stats
 * Advocate-only endpoint. Aggregated counts via Prisma + raw SQL.
 * IMPORTANT: Must be registered BEFORE /:id in the Express router.
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

const WORKER_USER   = { user_id: "ww-0001", role: "worker",   city_zone_id: null };
const ADVOCATE_USER = { user_id: "aa-0001", role: "advocate", city_zone_id: null };
const AUTH_HEADER   = { Authorization: "Bearer fake-token" };

function setupStatsMocks() {
    mockPrisma.grievances.count.mockResolvedValue(42);
    mockPrisma.grievances.groupBy
        .mockResolvedValueOnce([
            { status: "open",      _count: { id: 30 } },
            { status: "escalated", _count: { id: 8  } },
            { status: "resolved",  _count: { id: 4  } },
        ])
        .mockResolvedValueOnce([
            { category: "commission_change", _count: { id: 20 } },
            { category: "deactivation",      _count: { id: 12 } },
        ]);
    mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ platform: "Careem", count: 25 }])
        .mockResolvedValueOnce([{ tag: "commission_increase", count: 10 }]);
}

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────
// Auth & role checks
// ─────────────────────────────────────────────────────
describe("GET /api/grievances/stats — auth & role", () => {
    test("no Authorization header returns 401", async () => {
        const resp = await request(app).get("/api/grievances/stats");
        expect(resp.status).toBe(401);
    });

    test("worker role returns 403", async () => {
        axios.get.mockResolvedValue({ data: WORKER_USER });
        const resp = await request(app)
            .get("/api/grievances/stats")
            .set(AUTH_HEADER);
        expect(resp.status).toBe(403);
    });

    test("advocate gets 200", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        setupStatsMocks();
        const resp = await request(app)
            .get("/api/grievances/stats")
            .set(AUTH_HEADER);
        expect(resp.status).toBe(200);
    });
});

// ─────────────────────────────────────────────────────
// Response shape — top-level keys
// ─────────────────────────────────────────────────────
describe("GET /api/grievances/stats — response shape", () => {
    beforeEach(() => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        setupStatsMocks();
    });

    test("response has total key", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(resp.body).toHaveProperty("total");
    });

    test("total is a number", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(typeof resp.body.total).toBe("number");
    });

    test("response has by_status key", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(resp.body).toHaveProperty("by_status");
    });

    test("by_status is an array", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(Array.isArray(resp.body.by_status)).toBe(true);
    });

    test("response has by_category key", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(resp.body).toHaveProperty("by_category");
    });

    test("by_category is an array", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(Array.isArray(resp.body.by_category)).toBe(true);
    });

    test("response has by_platform key", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(resp.body).toHaveProperty("by_platform");
    });

    test("by_platform is an array", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(Array.isArray(resp.body.by_platform)).toBe(true);
    });

    test("response has trending_tags key", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(resp.body).toHaveProperty("trending_tags");
    });

    test("trending_tags is an array", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(Array.isArray(resp.body.trending_tags)).toBe(true);
    });

    test("total matches mocked count value", async () => {
        const resp = await request(app).get("/api/grievances/stats").set(AUTH_HEADER);
        expect(resp.body.total).toBe(42);
    });
});
