"use strict";
/**
 * TDD — Phase H4.1: GET /api/grievances/clusters
 * Advocate-only endpoint. Groups grievances by platform+category using raw SQL.
 * IMPORTANT: Must be registered BEFORE /:id or Express matches "clusters" as an ID.
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

const SAMPLE_CLUSTER = {
    platform_name: "Careem",
    category: "commission_change",
    complaint_count: 12,
    earliest: new Date("2026-01-01"),
    latest: new Date("2026-01-30"),
    escalated_count: 3,
    common_tags: ["commission_increase"],
    sample_descriptions: ["My commission was raised without notice"],
};

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────
// Auth & role checks
// ─────────────────────────────────────────────────────
describe("GET /api/grievances/clusters — auth & role", () => {
    test("no Authorization header returns 401", async () => {
        const resp = await request(app).get("/api/grievances/clusters");
        expect(resp.status).toBe(401);
    });

    test("worker role returns 403", async () => {
        axios.get.mockResolvedValue({ data: WORKER_USER });
        const resp = await request(app)
            .get("/api/grievances/clusters")
            .set(AUTH_HEADER);
        expect(resp.status).toBe(403);
    });

    test("advocate gets 200", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([]);
        const resp = await request(app)
            .get("/api/grievances/clusters")
            .set(AUTH_HEADER);
        expect(resp.status).toBe(200);
    });
});

// ─────────────────────────────────────────────────────
// Response shape
// ─────────────────────────────────────────────────────
describe("GET /api/grievances/clusters — response shape", () => {
    test("response is an array", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([SAMPLE_CLUSTER]);
        const resp = await request(app)
            .get("/api/grievances/clusters")
            .set(AUTH_HEADER);
        expect(Array.isArray(resp.body)).toBe(true);
    });

    test("empty DB returns empty array", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([]);
        const resp = await request(app)
            .get("/api/grievances/clusters")
            .set(AUTH_HEADER);
        expect(resp.body).toEqual([]);
    });

    test("cluster item has platform_name field", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([SAMPLE_CLUSTER]);
        const resp = await request(app)
            .get("/api/grievances/clusters")
            .set(AUTH_HEADER);
        expect(resp.body[0]).toHaveProperty("platform_name");
    });

    test("cluster item has category field", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([SAMPLE_CLUSTER]);
        const resp = await request(app)
            .get("/api/grievances/clusters")
            .set(AUTH_HEADER);
        expect(resp.body[0]).toHaveProperty("category");
    });

    test("cluster item has complaint_count field", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([SAMPLE_CLUSTER]);
        const resp = await request(app)
            .get("/api/grievances/clusters")
            .set(AUTH_HEADER);
        expect(resp.body[0]).toHaveProperty("complaint_count");
    });
});

// ─────────────────────────────────────────────────────
// Query parameter handling
// ─────────────────────────────────────────────────────
describe("GET /api/grievances/clusters — query params", () => {
    test("no query params uses defaults and returns 200", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([]);
        const resp = await request(app)
            .get("/api/grievances/clusters")
            .set(AUTH_HEADER);
        expect(resp.status).toBe(200);
    });

    test("days=60 param is accepted", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([]);
        const resp = await request(app)
            .get("/api/grievances/clusters?days=60")
            .set(AUTH_HEADER);
        expect(resp.status).toBe(200);
    });

    test("min_cluster_size=5 param is accepted", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([]);
        const resp = await request(app)
            .get("/api/grievances/clusters?min_cluster_size=5")
            .set(AUTH_HEADER);
        expect(resp.status).toBe(200);
    });

    test("both params together are accepted", async () => {
        axios.get.mockResolvedValue({ data: ADVOCATE_USER });
        mockPrisma.$queryRaw.mockResolvedValue([SAMPLE_CLUSTER]);
        const resp = await request(app)
            .get("/api/grievances/clusters?days=60&min_cluster_size=5")
            .set(AUTH_HEADER);
        expect(resp.status).toBe(200);
    });
});
