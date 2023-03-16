import { Router } from "express";

import songs from "./songs/songs.routes.js";

const router = Router();

router.get("/", (_, res) => {
	res.json({
		message: "osum!player server API v1",
	});
});

router.use("/songs", songs);

export default router;
