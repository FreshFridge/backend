import express from "express";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler";
import { normalizeBody } from "./middleware/normalizeBody";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { responseFormatter } from "./middleware/responseFormatter";
import authRoutes from "./modules/auth/auth.routes";
import productsRoutes from "./modules/products/products.routes";
import fridgesRoutes from "./modules/fridges/fridges.routes";
import shelvesRoutes from "./modules/shelves/shelves.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import jobsRoutes from "./modules/jobs/jobs.routes";
import telemetryRoutes from "./modules/iot/telemetry/telemetry.routes";
import iotDevicesRoutes from "./modules/iot/devices/iotDevices.routes";
import adminRoutes from "./modules/admin/admin.routes";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import fs from "fs";
import path from "path";

dotenv.config();

export const app = express();
app.use(express.json());
app.use(normalizeBody);
app.use(responseFormatter);

const openapiPath = fs.existsSync(path.join(__dirname, "docs", "openapi.yaml"))
  ? path.join(__dirname, "docs", "openapi.yaml")
  : path.join(__dirname, "..", "src", "docs", "openapi.yaml");
const openapiFile = fs.readFileSync(openapiPath, "utf8");
const openapiDocument = YAML.parse(openapiFile);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "FreshFridge API" });
});

app.get("/", (req, res) => {
  res.redirect("/docs");
});

app.use(authRoutes);
app.use(productsRoutes);
app.use(fridgesRoutes);
app.use(shelvesRoutes);
app.use(notificationsRoutes);
app.use(jobsRoutes);
app.use(iotDevicesRoutes);
app.use(telemetryRoutes);
app.use(adminRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
