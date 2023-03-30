import { Router } from "express";
import {
	findSongs,
	getSongFile,
	getSongImage,
	getMarker,
	findSongIdsByQuery,
	findIdsByOffset,
	findIdsByModifiedDate,
	reload,
	watch,
	stopWatch,
	clearMarker,
	addMarker,
	findSongRandom,
} from "./songs.services.js";
import { getSong, getId } from "../../middlewares.js";

const router = Router();

const defaultSongColumnsSelection = {
	artist: true,
	title: true,
	id: true,
	image: true,
	modified: true,
};

router.get("/", async (req, res, next) => {
	if (req.query.hasOwnProperty("q")) {
		return res.json(
			await findSongIdsByQuery(
				req.query.q,
				parseInt(req.query.limit || 8),
				parseInt(req.query.offset || 0)
			)
		);
	}
	next();
});

router.post("/", async (req, res, _next) => {
	if (req.query.hasOwnProperty("watch")) {
		watch();
		res.json({ message: "Watching for changes" });
	} else {
		stopWatch();
		res.json({ message: "Stopped watching for changes" });
	}
});

router.post("/reload", async (req, res, next) => {
	const start = Date.now();

	const full = req.query.hasOwnProperty("full");
	try {
		await reload(full);
	} catch (err) {
		return next(err);
	}

	const end = Date.now();
	res.json(`Reloaded songs in ${end - start}ms`);
});

router.patch("/:id/marker", getId, async (req, res, next) => {
	if (!req.body.marker) return next(new Error("Invalid body"));
	if (req.body.marker === "clear") {
		try {
			await clearMarker(req.id);
		} catch (err) {
			return next(err);
		}

		return res.json({ message: "Cleared marker" });
	}

	const marker = parseFloat(req.body.marker);

	if (isNaN(marker)) return next(new Error("Marker must be a number"));

	try {
		await addMarker(req.id, marker);
	} catch (err) {
		return next(err);
	}

	res.json({ message: "Added marker" });
});

router.get("/offset/:offset", async (req, res, next) => {
	const offset = parseInt(req.params.offset);

	if (isNaN(offset)) return next(new Error("Invalid offset"));

	const sortByModifiedDate = req.query.hasOwnProperty("sortByModifiedDate");

	let songs = null;
	try {
		songs = sortByModifiedDate
			? await findIdsByModifiedDate(offset)
			: await findIdsByOffset(offset);
	} catch (err) {
		return next(err);
	}

	if (songs == null) return next(new Error("Failed to get songs"));

	res.json(songs);
});

router.get("/random", async (_req, res, _next) => {
	const song = await findSongRandom(defaultSongColumnsSelection);
	res.json(song);
});

router.get("/:id/file", getId, async (req, res, next) => {
	let filename = null;
	try {
		filename = await getSongFile(req.id);
	} catch (err) {
		return next(err);
	}

	if (filename === null) {
		res.status(404);
		res.end();
		return;
	}

	res.setHeader("Content-Type", "audio/mpeg");
	res.sendFile(filename);
});

router.get("/:id/image", getId, async (req, res, next) => {
	const full = req.query.hasOwnProperty("full");

	let image;
	try {
		image = await getSongImage(req.id, full);
	} catch (err) {
		return next(err);
	}

	if (image === null) {
		res.status(404);
		res.end();
		return;
	}

	res.setHeader("Cache-control", "public, max-age=3600");
	res.setHeader("Content-Type", "image");
	res.end(image);
});

router.post("/multiple", async (req, res, next) => {
	if (!req.body.ids) return next(new Error("Invalid body"));
	if (req.query.ids == "") return res.json([]);

	const songs = await findSongs(req.body.ids, defaultSongColumnsSelection);
	res.json(songs);
});

router.get("/:id/marker", getId, async (req, res, next) => {
	const marker = await getMarker(req.id);

	res.json(marker);
});

router.get("/:id", getId, getSong, async (req, res, next) => {
	const song = req.song;

	if (song == null) {
		res.status(404);
		res.end();
		return;
	}

	res.json(song);
});

router.get("/changes", async (req, res, _next) => {
	// TODO: Get changes such as when songs are deleted or added to reflect to the client. Use request query to determine if the changes should be flushed.
	// WebSocket is probably the best way to do this.

	res.end();
});

export default router;
