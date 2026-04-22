"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const authenticate = require("../middleware/auth");
const { requireRole } = require("../middleware/auth");
const { autoTag } = require("../services/autoTagger");
const { createSchema, statusSchema, listQuerySchema, clustersQuerySchema } = require("../validators/grievanceValidator");

const router = express.Router();
const prisma = new PrismaClient();

const VALID_TRANSITIONS = {
    open: ["escalated", "resolved"],
    escalated: ["resolved"],
    resolved: [],
};

// POST /api/grievances
router.post("/", authenticate, async (req, res, next) => {
    try {
        const { error, value } = createSchema.validate(req.body);
        if (error) return res.status(400).json({ detail: error.details[0].message });

        const cleanDesc = value.description.replace(/<[^>]*>/g, "").trim();
        const tags = autoTag(cleanDesc);

        const grievance = await prisma.grievances.create({
            data: {
                worker_id: req.user.user_id,
                platform_id: value.platform_id,
                category: value.category,
                description: cleanDesc,
                is_anonymous: value.is_anonymous ?? true,
                grievance_tags: {
                    create: tags.map((tag) => ({ tag })),
                },
            },
            include: {
                grievance_tags: true,
                worker: { select: { display_name: true } },
                platform: { select: { name: true } },
            },
        });

        const { worker, platform, ...rest } = grievance;
        const out = {
            ...rest,
            worker_id:    grievance.is_anonymous ? null : grievance.worker_id,
            worker_name:  grievance.is_anonymous ? null : (worker?.display_name ?? null),
            platform_name: platform?.name ?? null,
        };
        return res.status(201).json(out);
    } catch (err) {
        next(err);
    }
});

// GET /api/grievances
router.get("/", authenticate, async (req, res, next) => {
    try {
        const { error, value } = listQuerySchema.validate(req.query, { abortEarly: false, convert: true });
        if (error) return res.status(400).json({ detail: error.details.map((d) => d.message).join("; ") });

        const { page, limit, platform_id, category, status, tag } = value;
        const skip = (page - 1) * limit;

        const where = {};
        if (platform_id) where.platform_id = platform_id;
        if (category) where.category = category;
        if (status) where.status = status;
        if (tag) where.grievance_tags = { some: { tag: { contains: tag, mode: "insensitive" } } };

        const [grievances, total] = await Promise.all([
            prisma.grievances.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: "desc" },
                include: {
                    grievance_tags: true,
                    worker: { select: { display_name: true } },
                    platform: { select: { name: true } },
                },
            }),
            prisma.grievances.count({ where }),
        ]);

        const items = grievances.map(({ worker, platform, ...g }) => ({
            ...g,
            worker_id:    g.is_anonymous ? null : g.worker_id,
            worker_name:  g.is_anonymous ? null : (worker?.display_name ?? null),
            platform_name: platform?.name ?? null,
        }));

        return res.json({
            items,
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit),
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/grievances/clusters  ← MUST be before /:id
router.get("/clusters", authenticate, requireRole("advocate"), async (req, res, next) => {
    try {
        const { error, value } = clustersQuerySchema.validate(req.query, { abortEarly: false, convert: true });
        if (error) return res.status(400).json({ detail: error.details.map((d) => d.message).join("; ") });

        const { days, min_cluster_size: minClusterSize } = value;

        const clusters = await prisma.$queryRaw`
            SELECT
                p.name AS platform_name,
                g.category,
                COUNT(*)::int AS complaint_count,
                MIN(g.created_at) AS earliest,
                MAX(g.created_at) AS latest,
                COUNT(*) FILTER (WHERE g.status = 'escalated')::int AS escalated_count,
                ARRAY_AGG(DISTINCT gt.tag) FILTER (WHERE gt.tag IS NOT NULL) AS common_tags,
                ARRAY(
                    SELECT LEFT(sub.description, 100)
                    FROM grievances sub
                    WHERE sub.platform_id = g.platform_id AND sub.category = g.category
                      AND sub.created_at >= NOW() - (${days} || ' days')::interval
                    ORDER BY sub.created_at DESC LIMIT 3
                ) AS sample_descriptions
            FROM grievances g
            JOIN platforms p ON g.platform_id = p.id
            LEFT JOIN grievance_tags gt ON g.id = gt.grievance_id
            WHERE g.created_at >= NOW() - (${days} || ' days')::interval
            GROUP BY p.name, g.category, g.platform_id
            HAVING COUNT(*) >= ${minClusterSize}
            ORDER BY COUNT(*) DESC
        `;
        return res.json(clusters);
    } catch (err) {
        next(err);
    }
});

// GET /api/grievances/stats  ← MUST be before /:id
router.get("/stats", authenticate, requireRole("advocate"), async (req, res, next) => {
    try {
        const [total, byStatus, byCategory, byPlatform, trendingTags] = await Promise.all([
            prisma.grievances.count(),
            prisma.grievances.groupBy({ by: ["status"], _count: { id: true } }),
            prisma.grievances.groupBy({
                by: ["category"],
                _count: { id: true },
                orderBy: { _count: { id: "desc" } },
            }),
            prisma.$queryRaw`
                SELECT p.name as platform, COUNT(*)::int as count
                FROM grievances g JOIN platforms p ON g.platform_id = p.id
                GROUP BY p.name ORDER BY count DESC
            `,
            prisma.$queryRaw`
                SELECT tag, COUNT(*)::int as count FROM grievance_tags
                GROUP BY tag ORDER BY count DESC LIMIT 10
            `,
        ]);

        return res.json({
            total,
            by_status: byStatus,
            by_category: byCategory,
            by_platform: byPlatform,
            trending_tags: trendingTags,
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/grievances/:id
router.get("/:id", authenticate, async (req, res, next) => {
    try {
        const g = await prisma.grievances.findUnique({
            where: { id: req.params.id },
            include: {
                grievance_tags: true,
                worker: { select: { display_name: true } },
                platform: { select: { name: true } },
            },
        });
        if (!g) return res.status(404).json({ detail: "Grievance not found" });

        const { worker, platform, ...rest } = g;
        const out = {
            ...rest,
            worker_id:    g.is_anonymous ? null : g.worker_id,
            worker_name:  g.is_anonymous ? null : (worker?.display_name ?? null),
            platform_name: platform?.name ?? null,
        };
        return res.json(out);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/grievances/:id/status  (advocate only)
router.patch("/:id/status", authenticate, requireRole("advocate"), async (req, res, next) => {
    try {
        const { error, value } = statusSchema.validate(req.body);
        if (error) return res.status(400).json({ detail: error.details[0].message });

        const g = await prisma.grievances.findUnique({ where: { id: req.params.id } });
        if (!g) return res.status(404).json({ detail: "Grievance not found" });

        const allowed = VALID_TRANSITIONS[g.status] || [];
        if (!allowed.includes(value.status)) {
            return res.status(409).json({
                detail: `Cannot transition from '${g.status}' to '${value.status}'`,
            });
        }

        const updated = await prisma.grievances.update({
            where: { id: req.params.id },
            data: {
                status: value.status,
                resolution_notes: value.resolution_notes,
                updated_at: new Date(),
            },
        });
        return res.json(updated);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/grievances/:id
router.delete("/:id", authenticate, async (req, res, next) => {
    try {
        const g = await prisma.grievances.findUnique({ where: { id: req.params.id } });
        if (!g) return res.status(404).json({ detail: "Grievance not found" });

        if (req.user.role !== "advocate" && g.worker_id !== req.user.user_id) {
            return res.status(403).json({ detail: "Cannot delete another worker's grievance" });
        }

        await prisma.grievances.delete({ where: { id: req.params.id } });
        return res.status(204).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
