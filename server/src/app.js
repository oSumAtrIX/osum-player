import express, { json } from "express";
import morgan from "morgan";
import cors from "cors";

import { notFound, handleError, checkAuthorization } from "./middlewares.js";
import api from "./api/index.js";

const app = express();

app.use(checkAuthorization);
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
app.use(handleError);

export default app;
