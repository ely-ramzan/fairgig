"use strict";

const express = require("express");
const cors = require("cors");
const grievanceRoutes = require("./routes/grievances");
const tagRoutes = require("./routes/tags");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "grievance" }));

app.use("/api/grievances", grievanceRoutes);
app.use("/api/grievances", tagRoutes);

app.use(errorHandler);

module.exports = app;
