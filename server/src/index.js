import app from "./app.js";
import config from "./config.js";

const port = config.SERVER_PORT;
app.listen(port, () => {
	console.log(`Listening: http://localhost:${port}`);
});
