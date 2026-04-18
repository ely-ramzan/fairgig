"use strict";

require("dotenv").config({ path: "../../.env" });

module.exports = {
    PORT: process.env.GRIEVANCE_PORT || 8004,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || "http://localhost:8001",
};
