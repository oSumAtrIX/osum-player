import { findSong } from "./api/songs/songs.services.js";
import config from "./config.js";

export function notFound(_req, res, next) {
	res.status(404);
	const error = new Error(`Not Found`);
	next(error);
}

export function errorHandler(err, _req, res, _next) {
	const statusCode = res.statusCode !== 200 ? res.statusCode : 400;
	res.status(statusCode);
	res.json({
		message: err.message,
		stack: err.stack,
	});
}

export function checkDemoMode(_req, res, next) {
	if (config.DEMO_MODE) return res.json({ message: "This API is not available in demo mode" });

	next();
}

export function getId(req, _res, next) {
	const id = parseInt(req.params.id);

	if (isNaN(id)) return next(new Error("Invalid song id"));

	req.id = id;

	next();
}

export async function getSong(req, _res, next) {
	if (!req.id) return next(new Error("No id"));

	try {
		req.song = await findSong(req.id);

		if (req.song === null) return next(new Error("Song not found"));
	} catch (err) {
		return next(err);
	}

	next();
}
