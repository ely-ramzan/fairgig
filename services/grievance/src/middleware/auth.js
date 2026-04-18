"use strict";

const axios = require("axios");
const { AUTH_SERVICE_URL } = require("../config");

async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ detail: "Authorization header missing" });
    }
    try {
        const { data } = await axios.get(`${AUTH_SERVICE_URL}/api/auth/validate`, {
            headers: { Authorization: header },
        });
        req.user = data;
        next();
    } catch {
        return res.status(401).json({ detail: "Invalid or expired token" });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user?.role)) {
            return res.status(403).json({ detail: `Requires role: ${roles.join(" or ")}` });
        }
        next();
    };
}

module.exports = authenticate;
module.exports.requireRole = requireRole;
