import config from "./config.js";

export function notFound(_req, res, next) {
	res.status(404);
	next(new Error(`Not found`));
}

export function handleError(err, _req, res, _next) {
	const statusCode = res.statusCode !== 200 ? res.statusCode : 400;
	res.status(statusCode);
	res.json({
		message: err.message,
		stack: err.stack,
	});
}
