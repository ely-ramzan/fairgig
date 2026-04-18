"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const authenticate = require("../middleware/auth");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/grievances/:id/tags  (advocate only)
router.post("/:id/tags", authenticate, requireRole("advocate"), async (req, res, next) => {
    try {
        const { tag } = req.body;
        if (!tag) return res.status(400).json({ detail: "tag is required" });

        const result = await prisma.grievance_tags.create({
            data: { grievance_id: req.params.id, tag },
        });
        return res.status(201).json(result);
    } catch (err) {
        if (err.code === "P2002") {
            return res.status(409).json({ detail: "Tag already exists" });
        }
        next(err);
    }
});

// DELETE /api/grievances/:id/tags/:tag  (advocate only)
router.delete("/:id/tags/:tag", authenticate, requireRole("advocate"), async (req, res, next) => {
    try {
        await prisma.grievance_tags.deleteMany({
            where: { grievance_id: req.params.id, tag: req.params.tag },
        });
        return res.status(204).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
