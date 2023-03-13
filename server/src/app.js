import express, { json } from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import { notFound, errorHandler } from "./middlewares.js";
import api from "./api/index.js";

const app = express();

app.use(morgan("dev"));
app.use(cors());
app.use(json());

app.get("/", (_req, res) => {
	res.json({
		message: "osum!player server API",
	});
});

app.use("/api/v1", api);

app.use(notFound);
app.use(errorHandler);

export default app;
