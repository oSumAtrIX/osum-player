import db from "../../utils/db.js";
import { parseFile } from "music-metadata";
import path from "path";
import imagemin from "imagemin";
import imageminWebp from "imagemin-webp";
import chokidar from "chokidar";
import parsePath from "parse-filepath";
import fs from "fs";

const songsPerOffset = parseInt(process.env.SONGS_PER_OFFSET);
let watcher = null;

// TODO: Watch on startup of server if enabled previously by saving when enabling and by env variable.
/**
 * Start watching for changes.
 */
export function watch() {
	stopWatch();

	const getBaseName = (file) => parsePath(file).basename;

	watcher = chokidar.watch(process.env.SONGS_PATH, {
		ignoreInitial: true,
		awaitWriteFinish: {
			stabilityThreshold: 2000,
			pollInterval: 500,
		},
		binaryInterval: 2000,
	});

	watcher
		.on("add", async (path) => {
			const filename = getBaseName(path);
			if (!(await isMissing(getBaseName(filename)))) return;

			await addSongByName(filename);
		})
		.on("unlink", async (path) => {
			const song = await findByFilename(getBaseName(path));
			await removeSong(song);
		});
}

/**
 * Stop watching for changes.
 */
export async function stopWatch() {
	await watcher?.close();
}

/**
 * Find a song by its id and a list of fields to select.
 * @param {number} id The id of the song.
 * @param {any} select The fields to select.
 * @returns A song.
 */
export function findSong(id, select) {
	return db.song.findUnique({
		where: {
			id,
		},
		select,
	});
}

/**
 * Find songs by their ids.
 * @param {number[]} ids The ids of the song.
 * @param {any} select The fields to select.
 * @returns A list of song ids.
 */
export function findSongs(ids, select) {
	return db.song.findMany({
		where: {
			id: { in: ids },
		},
		select,
	});
}

export async function getSongFile(id) {
	const song = await findSong(id, {
		filename: true,
	});

	return path.join(process.env.SONGS_PATH, song.filename);
}

export function getSongImage(id, full = false) {
	return findSong(
		id,
		full
			? {
					full_image: true,
			  }
			: {
					image: true,
			  }
	);
}

/**
 * Find song ids given a query.
 * @param {string} query The query to search for.
 * @param {number} limit The limit of songs to return.
 * @param {number} offset The offset to start at.
 * @returns A list of song ids.
 */
export function findSongIdsByQuery(query, limit = 8, offset = 0) {
	return db.song.findMany({
		where: {
			OR: [
				{ title: { contains: query } },
				{ artist: { contains: query } },
				{ filename: { contains: query } },
			],
		},
		take: limit,
		skip: offset,
		select: {
			id: true,
		},
	});
}

/**
 * Find all songs in the database given an offset id.
 * @param {number} offsetId The offset id to start at.
 * @returns A list of songs.
 */
export function findIdsByOffset(offsetId) {
	return db.song.findMany({
		where: { id: { gte: offsetId } },
		take: songsPerOffset,
		select: {
			id: true,
		},
	});
}

/**
 * Add a song to the database.
 * @param {Song} song The song to add.
 */
function add(song) {
	if (song.title == "") song.title = song.filename;

	return db.song.create({
		data: song,
	});
}

/**
 * Remove a song from the database.
 * @param {Song} song The song to remove.
 */
async function removeSong(song) {
	return db.song.delete({
		where: {
			id: song.id,
		},
	});
}

/**
 * Removes songs from the database.
 * @param {Song[]} songs The songs to remove.
 * @returns The number of songs removed.
 */
function removeSongs(songs) {
	return db.song.deleteMany({
		where: {
			id: { in: songs.map((song) => song.id) },
		},
	});
}

/**
 * Finds songs by their filename.
 * @param {string[]} names A list of filenames
 * @returns A list of songs.
 */
function findByFilenames(names) {
	return db.song.findMany({
		where: {
			filename: { in: names },
		},
	});
}

/**
 * Finds song by their filename.
 * @param {string} name A filename.
 * @returns A song.
 */
function findByFilename(name) {
	return db.song.findUnique({
		where: {
			filename: name,
		},
	});
}

/**
 * Parses a song from a file.
 * @param {string} name The filename of the song
 */
async function parseSongFromFile(name) {
	const metadata = await parseFile(path.join(process.env.SONGS_PATH, name));

	const song = {
		title: metadata.common.title,
		artist: metadata.common.artist,
		filename: name,
	};

	// Some songs don't have an image
	if (metadata.common.picture) {
		song.full_image = metadata.common.picture[0].data;
		song.image = await imagemin.buffer(song.full_image, {
			plugins: [imageminWebp({ resize: { width: 64, height: 64 } })],
		});
	}

	return song;
}

/**
 * Gets all song names from the songs folder.
 * @returns A list of song filenames.
 */
function getSongNamesFromPath() {
	return fs
		.readdirSync(process.env.SONGS_PATH, { withFileTypes: true })
		.filter((file) => file.isFile())
		.map((file) => file.name);
}

/**
 * Adds songs to the database given a list of filenames.
 * @param {string[]} filenames A list of song filenames.
 */
async function addSongsByName(filenames) {
	const promises = [];

	for (const name of filenames) {
		const parse = parseSongFromFile(name);
		promises.push(parse);

		// Add 10 songs at a time
		if (promises.length <= 10) continue;

		const songs = (await Promise.allSettled(promises))
			.filter((p) => p.value)
			.map((p) => p.value);

		await Promise.all(songs.map((song) => add(song)));
		promises.length = 0;
	}
}

/**
 * Adds a song to the database given a filename.
 * @param {string} filename The filename of the song.
 */
async function addSongByName(filename) {
	const song = await parseSongFromFile(filename);
	await add(song);
}

/**
 * Finds the names of songs that are not in the database.
 * @param {string[]} filenames A list of song filenames. If not provided, it will get all the songs in the songs folder.
 * @returns {string[]} A list of song filenames that are not in the database.
 */
async function findMissingSongs(filenames) {
	const names = filenames || getSongNamesFromPath();

	const existing = await findByFilenames(names);
	const missingSongs = names.filter(
		(song) => !existing.find((name) => song === name.filename)
	);

	return missingSongs;
}

/**
 * Checks if a song is missing from the database.
 * @param {string} filename The filename of the song.
 * @returns {boolean} True if the song is missing, false otherwise.
 */
async function isMissing(filename) {
	const existing = await findByFilename(filename);
	return !existing;
}

/**
 * Finds the songs that are orphaned in the database.
 * @param {string[]} filenames A list of song filenames. If not provided, it will get all the songs in the songs folder.
 * @returns {string[]} A list of songs that do not exist anymore.
 */
async function findOrphanedSongs(filenames) {
	const names = filenames || getSongNamesFromPath();

	const existing = await db.song.findMany({
		select: {
			id: true,
			filename: true,
		},
	});

	const orphaned = existing.filter(
		(song) => !names.find((name) => song.filename === name)
	);

	return orphaned;
}

/**
 * Reloads the database with the songs in the songs folder.
 * It will add songs that are missing and remove songs that are orphaned.
 */
export async function reload() {
	const songNames = getSongNamesFromPath();

	const missingSongs = await findMissingSongs(songNames);
	await addSongsByName(missingSongs);

	const orphanedSongs = await findOrphanedSongs(songNames);
	await removeSongs(orphanedSongs);
}
