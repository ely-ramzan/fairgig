"use strict";

const app = require("./app");
const { PORT } = require("./config");

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Grievance service on :${PORT}`));
}

module.exports = app;