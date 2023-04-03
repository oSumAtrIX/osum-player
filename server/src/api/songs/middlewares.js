import { findSong } from "./songs.services.js";
import config from "../../config.js";

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