import dotenv from "dotenv";

dotenv.config();

const config = {
	SERVER_PORT: parseInt(process.env.SERVER_PORT),
	SONGS_PATH: process.env.SONGS_PATH,
	IMAGE_CACHE_PATH: process.env.IMAGE_CACHE_PATH,
	SONGS_PER_OFFSET: parseInt(process.env.SONGS_PER_OFFSET),
	DEMO_MODE: process.env.DEMO_MODE === "true",
	AUTH_TOKEN: process.env.AUTH_TOKEN
};

export default config;