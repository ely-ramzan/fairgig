"use strict";
/**
 * TDD — Phase H3.9-H3.11: POST/GET/PATCH/DELETE /api/grievances
 * Uses mocked Prisma + mocked axios (auth service).
 */

// --- Mock Prisma ---
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
    grievance_tags: {
        create: jest.fn(),
        deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
};
jest.mock("@prisma/client", () => ({
    PrismaClient: jest.fn(() => mockPrisma),
}));

// --- Mock axios (auth middleware) ---
const axios = require("axios");
jest.mock("axios");

const request = require("supertest");
const app = require("../src/app");

const WORKER_ID = "00000000-0000-0000-0000-000000000001";
const ADVOCATE_ID = "00000000-0000-0000-0000-000000000002";
const PLATFORM_ID = "550e8400-e29b-41d4-a716-446655440000";
const GRIEVANCE_ID = "aaaaaaaa-0000-0000-0000-000000000001";

const WORKER_USER = { user_id: WORKER_ID, role: "worker", city_zone_id: null };
const ADVOCATE_USER = { user_id: ADVOCATE_ID, role: "advocate", city_zone_id: null };

const AUTH_HEADER = { Authorization: "Bearer fake-token" };

function mockAuth(user) {
    axios.get.mockResolvedValue({ data: user });
}

function makeGrievance(overrides = {}) {
    return {
        id: GRIEVANCE_ID,
        worker_id: WORKER_ID,
        platform_id: PLATFORM_ID,
        category: "commission_change",
        description: "My commission rate was raised without any notice",
        status: "open",
        is_anonymous: false,
        resolution_notes: null,
        created_at: new Date("2026-01-10T10:00:00Z"),
        updated_at: new Date("2026-01-10T10:00:00Z"),
        grievance_tags: [],
        ...overrides,
    };
}

const VALID_CREATE_BODY = {
    platform_id: PLATFORM_ID,
    category: "commission_change",
    description: "My commission rate was raised without any notice",
    is_anonymous: false,
};

beforeEach(() => {
    jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────
// POST /api/grievances
// ─────────────────────────────────────────────────────
describe("POST /api/grievances", () => {
    test("no auth header returns 401", async () => {
        const resp = await request(app).post("/api/grievances").send(VALID_CREATE_BODY);
        expect(resp.status).toBe(401);
    });

    test("valid body returns 201", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.create.mockResolvedValue(makeGrievance());

        const resp = await request(app)
            .post("/api/grievances")
            .set(AUTH_HEADER)
            .send(VALID_CREATE_BODY);

        expect(resp.status).toBe(201);
    });

    test("created grievance is in the response body", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.create.mockResolvedValue(makeGrievance());

        const resp = await request(app)
            .post("/api/grievances")
            .set(AUTH_HEADER)
            .send(VALID_CREATE_BODY);

        expect(resp.body).toHaveProperty("id");
        expect(resp.body).toHaveProperty("category", "commission_change");
    });

    test("anonymous grievance masks worker_id in response", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.create.mockResolvedValue(
            makeGrievance({ is_anonymous: true, worker_id: WORKER_ID })
        );

        const resp = await request(app)
            .post("/api/grievances")
            .set(AUTH_HEADER)
            .send({ ...VALID_CREATE_BODY, is_anonymous: true });

        expect(resp.status).toBe(201);
        expect(resp.body.worker_id).toBeNull();
    });

    test("invalid category returns 400", async () => {
        mockAuth(WORKER_USER);

        const resp = await request(app)
            .post("/api/grievances")
            .set(AUTH_HEADER)
            .send({ ...VALID_CREATE_BODY, category: "bad_category" });

        expect(resp.status).toBe(400);
    });

    test("description under 10 chars returns 400", async () => {
        mockAuth(WORKER_USER);

        const resp = await request(app)
            .post("/api/grievances")
            .set(AUTH_HEADER)
            .send({ ...VALID_CREATE_BODY, description: "Short" });

        expect(resp.status).toBe(400);
    });

    test("missing platform_id returns 400", async () => {
        mockAuth(WORKER_USER);

        const resp = await request(app)
            .post("/api/grievances")
            .set(AUTH_HEADER)
            .send({ category: "commission_change", description: "Long enough description here" });

        expect(resp.status).toBe(400);
    });

    test("autoTag keywords in description result in tags being saved", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.create.mockResolvedValue(
            makeGrievance({
                description: "The app crash caused my commission to increase",
                grievance_tags: [{ tag: "app_issue" }, { tag: "commission_increase" }],
            })
        );

        const resp = await request(app)
            .post("/api/grievances")
            .set(AUTH_HEADER)
            .send({
                ...VALID_CREATE_BODY,
                description: "The app crash caused my commission to increase",
            });

        expect(resp.status).toBe(201);
        // Prisma create was called with tags in the data
        const callArg = mockPrisma.grievances.create.mock.calls[0][0];
        expect(callArg.data.grievance_tags.create.length).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────
// GET /api/grievances
// ─────────────────────────────────────────────────────
describe("GET /api/grievances", () => {
    test("no auth returns 401", async () => {
        const resp = await request(app).get("/api/grievances");
        expect(resp.status).toBe(401);
    });

    test("with auth returns 200", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.findMany.mockResolvedValue([]);
        mockPrisma.grievances.count.mockResolvedValue(0);

        const resp = await request(app)
            .get("/api/grievances")
            .set(AUTH_HEADER);

        expect(resp.status).toBe(200);
    });

    test("response has items, total, page, limit, total_pages keys", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.findMany.mockResolvedValue([makeGrievance()]);
        mockPrisma.grievances.count.mockResolvedValue(1);

        const resp = await request(app)
            .get("/api/grievances")
            .set(AUTH_HEADER);

        expect(resp.body).toHaveProperty("items");
        expect(resp.body).toHaveProperty("total");
        expect(resp.body).toHaveProperty("page");
        expect(resp.body).toHaveProperty("limit");
        expect(resp.body).toHaveProperty("total_pages");
    });

    test("anonymous grievances have worker_id masked", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.findMany.mockResolvedValue([
            makeGrievance({ is_anonymous: true }),
        ]);
        mockPrisma.grievances.count.mockResolvedValue(1);

        const resp = await request(app)
            .get("/api/grievances")
            .set(AUTH_HEADER);

        expect(resp.body.items[0].worker_id).toBeNull();
    });
});

// ─────────────────────────────────────────────────────
// GET /api/grievances/:id
// ─────────────────────────────────────────────────────
describe("GET /api/grievances/:id", () => {
    test("no auth returns 401", async () => {
        const resp = await request(app).get(`/api/grievances/${GRIEVANCE_ID}`);
        expect(resp.status).toBe(401);
    });

    test("existing grievance returns 200", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(makeGrievance());

        const resp = await request(app)
            .get(`/api/grievances/${GRIEVANCE_ID}`)
            .set(AUTH_HEADER);

        expect(resp.status).toBe(200);
    });

    test("non-existent grievance returns 404", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(null);

        const resp = await request(app)
            .get(`/api/grievances/${GRIEVANCE_ID}`)
            .set(AUTH_HEADER);

        expect(resp.status).toBe(404);
    });

    test("anonymous grievance masks worker_id", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(
            makeGrievance({ is_anonymous: true })
        );

        const resp = await request(app)
            .get(`/api/grievances/${GRIEVANCE_ID}`)
            .set(AUTH_HEADER);

        expect(resp.body.worker_id).toBeNull();
    });
});

// ─────────────────────────────────────────────────────
// PATCH /api/grievances/:id/status
// ─────────────────────────────────────────────────────
describe("PATCH /api/grievances/:id/status", () => {
    test("worker role returns 403", async () => {
        mockAuth(WORKER_USER);

        const resp = await request(app)
            .patch(`/api/grievances/${GRIEVANCE_ID}/status`)
            .set(AUTH_HEADER)
            .send({ status: "escalated" });

        expect(resp.status).toBe(403);
    });

    test("advocate can transition open → escalated", async () => {
        mockAuth(ADVOCATE_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(makeGrievance({ status: "open" }));
        mockPrisma.grievances.update.mockResolvedValue(makeGrievance({ status: "escalated" }));

        const resp = await request(app)
            .patch(`/api/grievances/${GRIEVANCE_ID}/status`)
            .set(AUTH_HEADER)
            .send({ status: "escalated" });

        expect(resp.status).toBe(200);
        expect(resp.body.status).toBe("escalated");
    });

    test("advocate can transition open → resolved", async () => {
        mockAuth(ADVOCATE_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(makeGrievance({ status: "open" }));
        mockPrisma.grievances.update.mockResolvedValue(makeGrievance({ status: "resolved" }));

        const resp = await request(app)
            .patch(`/api/grievances/${GRIEVANCE_ID}/status`)
            .set(AUTH_HEADER)
            .send({ status: "resolved" });

        expect(resp.status).toBe(200);
    });

    test("invalid transition resolved → escalated returns 409", async () => {
        mockAuth(ADVOCATE_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(
            makeGrievance({ status: "resolved" })
        );

        const resp = await request(app)
            .patch(`/api/grievances/${GRIEVANCE_ID}/status`)
            .set(AUTH_HEADER)
            .send({ status: "escalated" });

        expect(resp.status).toBe(409);
    });

    test("patching non-existent grievance returns 404", async () => {
        mockAuth(ADVOCATE_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(null);

        const resp = await request(app)
            .patch(`/api/grievances/${GRIEVANCE_ID}/status`)
            .set(AUTH_HEADER)
            .send({ status: "escalated" });

        expect(resp.status).toBe(404);
    });

    test("invalid status value returns 400", async () => {
        mockAuth(ADVOCATE_USER);

        const resp = await request(app)
            .patch(`/api/grievances/${GRIEVANCE_ID}/status`)
            .set(AUTH_HEADER)
            .send({ status: "pending" });

        expect(resp.status).toBe(400);
    });
});

// ─────────────────────────────────────────────────────
// DELETE /api/grievances/:id
// ─────────────────────────────────────────────────────
describe("DELETE /api/grievances/:id", () => {
    test("no auth returns 401", async () => {
        const resp = await request(app).delete(`/api/grievances/${GRIEVANCE_ID}`);
        expect(resp.status).toBe(401);
    });

    test("worker deleting own grievance returns 204", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(
            makeGrievance({ worker_id: WORKER_ID })
        );
        mockPrisma.grievances.delete.mockResolvedValue({});

        const resp = await request(app)
            .delete(`/api/grievances/${GRIEVANCE_ID}`)
            .set(AUTH_HEADER);

        expect(resp.status).toBe(204);
    });

    test("worker deleting another worker's grievance returns 403", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(
            makeGrievance({ worker_id: "other-worker-uuid" })
        );

        const resp = await request(app)
            .delete(`/api/grievances/${GRIEVANCE_ID}`)
            .set(AUTH_HEADER);

        expect(resp.status).toBe(403);
    });

    test("advocate can delete any grievance and returns 204", async () => {
        mockAuth(ADVOCATE_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(
            makeGrievance({ worker_id: WORKER_ID })
        );
        mockPrisma.grievances.delete.mockResolvedValue({});

        const resp = await request(app)
            .delete(`/api/grievances/${GRIEVANCE_ID}`)
            .set(AUTH_HEADER);

        expect(resp.status).toBe(204);
    });

    test("deleting non-existent grievance returns 404", async () => {
        mockAuth(WORKER_USER);
        mockPrisma.grievances.findUnique.mockResolvedValue(null);

        const resp = await request(app)
            .delete(`/api/grievances/${GRIEVANCE_ID}`)
            .set(AUTH_HEADER);

        expect(resp.status).toBe(404);
    });
});
