export function notFound(_req, res, next) {
	res.status(404);
	const error = new Error(`Not Found`);
	next(error);
}

export function errorHandler(err, _req, res, _next) {
	const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
	res.status(statusCode);
	res.json({
		message: err.message,
		stack: err.stack,
	});
}
