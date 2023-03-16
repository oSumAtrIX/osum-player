import { query, Router } from "express";
import {
	findSongs,
	getSongFile,
	getSongImage,
	findSong,
	findSongIdsByQuery,
	findIdsByOffset,
	findIdsByModifiedDate,
	reload,
	watch,
	stopWatch,
} from "./songs.services.js";

const router = Router();

router.get("/", async (req, res, next) => {
	if (req.query.hasOwnProperty("q")) {
		res.json(
			await findSongIdsByQuery(
				req.query.q,
				parseInt(req.query.limit || 8),
				parseInt(req.query.offset || 0)
			)
		);
	} else {
		next();
	}
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

router.post("/reload", async (_req, res, next) => {
	try {
		const start = Date.now();
		await reload();
		const end = Date.now();
		res.json(`Reloaded songs in ${end - start}ms`);
	} catch (err) {
		next(err);
	}
});

router.patch("/:id", async (_req, res, _next) => {
	// TODO: Add marker to database
	res.end();
});

router.get("/offset/:offset", async (req, res, next) => {
	try {
		const sortByModifiedDate = req.query.hasOwnProperty("sortByModifiedDate");
		const offset = parseInt(req.params.offset);

		const songs = sortByModifiedDate
			? await findIdsByModifiedDate(offset)
			: await findIdsByOffset(offset);

		res.json(songs);
	} catch (err) {
		next(err);
	}
});

router.get("/:id/file", async (req, res, next) => {
	try {
		const id = parseInt(req.params.id);
		const filename = await getSongFile(id);

		res.setHeader("Content-Type", "audio/mpeg");

		res.sendFile(filename);
	} catch (err) {
		next(err);
	}
});

router.get("/:id/image", async (req, res, next) => {
	try {
		const id = parseInt(req.params.id);
		const full = req.query.hasOwnProperty("full");

		const image = await getSongImage(id, full);

		if (image === null) {
			res.status(404);
			res.end();
			return;
		}

		res.setHeader("Cache-control", "public, max-age=3600");
		res.setHeader("Content-Type", "image");
		res.end(image);
	} catch (err) {
		next(err);
	}
});

router.get("/multiple", async (req, res, next) => {
	if (req.query.hasOwnProperty("ids")) {
		if (req.query.ids == "") return res.json([]);

		const ids = req.query.ids.split(",").map((id) => parseInt(id));

		const songs = await findSongs(ids);

		res.json(songs);
	}
});

router.get("/:id", async (req, res, next) => {
	try {
		const id = parseInt(req.params.id);

		const select = {
			id: true,
			title: true,
			artist: true,
			image: true, // required to detemine if the song should use a placeholder image
			modified: true, // required for sorting in search for example
		};

		const song = await findSong(id, select);

		if (song == null) {
			res.status(404);
			res.end();
			return;
		}

		res.json(song);
	} catch (err) {
		next(err);
	}
});

router.get("/changes", async (req, res, _next) => {
	// TODO: Get changes such as when songs are deleted or added to reflect to the client. Use request query to determine if the changes should be flushed.
	// WebSocket is probably the best way to do this.

	res.end();
});

export default router;
