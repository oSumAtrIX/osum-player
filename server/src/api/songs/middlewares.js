import { findSong } from "./songs.services.js";
import config from "../../config.js";
import {
	getSongIdFromToken
} from "./songs.services.js";

export function isReadOnly(_req, res, next) {
	if (config.READ_ONLY) {
		res.status(403);
		return res.json({ message: "Not allowed in read-only mode" });
	}

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

export function checkAuth(req, res, next) {
	if (req.bypassAuth)
		return next();

	if (req.method === "OPTIONS")
		return next();

	if (!config.AUTH_TOKEN || req.cookies.authorization === config.AUTH_TOKEN)
		return next();

	res.status(401);
	res.end();
}

export async function checkToken(req, _, next) {
	if (!req.query.token)
		return next();

	if (await getSongIdFromToken(req.query.token) === req.id)
		req.bypassAuth = true;

	next();
}
