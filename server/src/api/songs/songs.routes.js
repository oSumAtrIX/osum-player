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
	createSongLink,
	getSongFromToken,
} from "./songs.services.js";
import { getSong, getId, isReadOnly, checkAuth, checkToken } from "./middlewares.js";

const router = Router();

const defaultSongColumnsSelection = {
	artist: true,
	title: true,
	id: true,
	image: true,
	modified: true,
};

router.get("/", checkAuth, async (req, res, next) => {
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

router.patch("/", checkAuth, isReadOnly, async (req, res) => {
	if (req.query.hasOwnProperty("watch")) {
		watch();
		res.json({ message: "Watching for changes" });
	} else {
		stopWatch();
		res.json({ message: "Stopped watching for changes" });
	}
});

router.post("/reload", checkAuth, isReadOnly, async (req, res, next) => {
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

router.patch("/:id/marker", checkAuth, isReadOnly, getId, async (req, res, next) => {
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

router.get("/:id/marker", getId, checkToken, checkAuth, async (req, res) => {
	const marker = await getMarker(req.id);

	res.json(marker);
});

router.get("/offset/:offset", checkAuth, async (req, res, next) => {
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

router.get("/random", checkAuth, async (_req, res) => {
	const song = await findSongRandom(defaultSongColumnsSelection);
	res.json(song);
});

router.get("/:id/file", getId, checkToken, checkAuth, async (req, res, next) => {
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

router.get("/:id/link", checkAuth, getId, async (req, res) => {
	const token = await createSongLink(req.id);

	res.json({ token });
});

router.get("/link", async (req, res) => {
	const song = await getSongFromToken(req.query.token);

	if (song === null) {
		res.status(404);
		res.end();
		return;
	}

	res.json(song);
});

router.get("/:id/image", getId, checkToken, checkAuth, async (req, res, next) => {
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

	res.setHeader("Cache-control", "public, max-age=31536000");
	res.setHeader("Content-Type", "image");
	res.end(image);
});

router.post("/multiple", checkAuth, async (req, res, next) => {
	if (!req.body.ids) return next(new Error("Invalid body"));
	if (req.query.ids == "") return res.json([]);

	const songs = await findSongs(req.body.ids, defaultSongColumnsSelection);
	res.json(songs);
});


router.get("/:id", getId, checkToken, checkAuth, getSong, async (req, res) => {
	const song = req.song;

	if (song == null) {
		res.status(404);
		res.end();
		return;
	}

	res.json(song);
});

router.get("/changes", checkAuth, async (_, res) => {
	// TODO: Get changes such as when songs are deleted or added to reflect to the client. Use request query to determine if the changes should be flushed.
	// WebSocket is probably the best way to do this.

	res.end();
});

export default router;
