import express from "express";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./modules/auth/auth.routes";
import productsRoutes from "./modules/products/products.routes";

dotenv.config();

export const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "FreshFridge API" });
});

app.use(authRoutes);
app.use(productsRoutes);
app.use(errorHandler);
