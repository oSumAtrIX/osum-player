import express, { json } from "express";
import morgan from "morgan";
import cors from "cors";

import { notFound, handleError, checkAuthorization } from "./middlewares.js";
import api from "./api/index.js";
import cookieParser from "cookie-parser";

const app = express();

app.use(morgan("dev"));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(checkAuthorization);
app.use(json());

app.get("/", (_req, res) => {
	res.json({
		message: "osum!player server API",
	});
});

app.use("/api/v1", api);

app.use(notFound);
app.use(handleError);

export default app;
