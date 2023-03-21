import db from "../../utils/db.js";
import { parseFile } from "music-metadata";
import path from "path";
import imagemin from "imagemin";
import imageminWebp from "imagemin-webp";
import chokidar from "chokidar";
import parsePath from "parse-filepath";
import fs from "fs";
import sha1 from "sha1";

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

export async function findSongRandom(select) {
	const skip = Math.floor(Math.random() * (await db.song.count()));

	const results = await db.song.findMany({
		take: 1,
		skip,
		select,
	});

	return results[0];
}

export async function getSongFile(id) {
	const song = await findSong(id, {
		filename: true,
	});

	if (song === null) return null;

	return path.join(process.env.SONGS_PATH, song.filename);
}

/**
 * Get the path to an image given a filename.
 *
 * @param {string} filename The filename of the song.
 * @param {boolean} full If the full image should be returned.
 * @returns
 */
function getImagePath(filename, full = false) {
	const imageName = sha1(filename + (full ? "_full" : ""));
	return path.join(process.env.IMAGE_CACHE_PATH, imageName);
}

export async function getSongImage(id, full = false) {
	const song = await findSong(id, {
		filename: true,
	});

	if (song === null) return null;

	// create path to image
	const imagePath = getImagePath(song.filename, full);

	// check if image exists and return it or create it
	const imageExists = await fileExists(imagePath);
	if (imageExists) return readFile(imagePath);

	let parsedSong;
	try {
		parsedSong = await parseSongFromFile(song.filename, true);
	} catch (e) {
		console.log(e);
	}

	if (!(parsedSong && parsedSong.image)) return null;

	const image = await compressImage(parsedSong.image, full ? 600 : 64);

	fs.createWriteStream(imagePath).end(image);

	return image;
}

/**
 * Find song ids given a query.
 * @param {string} query The query to search for.
 * @param {number} limit The limit of songs to return.
 * @param {number} offset The offset to start at.
 * @param {boolean} orderByModifiedDate Whether to order by modified date.
 * @returns A list of song ids.
 */
export function findSongIdsByQuery(query, limit, offset, orderByModifiedDate) {
	const args = {
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
	};

	if (orderByModifiedDate)
		args.orderBy = {
			modified: "desc",
		};

	return db.song.findMany(args);
}

/**
 * Find all songs in the database given an offset id.
 * @param {number} offset The offset id to start at.
 * @returns A list of songs.
 */
export function findIdsByOffset(offset) {
	const args = {
		where: { id: { gte: offset } },
		take: songsPerOffset,
		select: {
			id: true,
		},
	};

	return db.song.findMany(args);
}

/**
 * Find all songs in the database given an offset id ordered by the song file modified date.
 * @param {number} page The page to start at.
 * @returns A list of songs.
 */
export function findIdsByModifiedDate(page) {
	const args = {
		orderBy: {
			modified: "desc",
		},
		skip: songsPerOffset * page,
		take: songsPerOffset,
		select: {
			id: true,
		},
	};

	return db.song.findMany(args);
}

/**
 * Add a song to the database.
 * @param {Song} song The song to add.
 */
function add(song) {
	return db.song.create({
		data: song,
	});
}

/**
 * Add a marker to a song.
 * @param {integer} songId The id of the song to add the marker to.
 * @param {*} marker The time of the marker.
 */
export function addMarker(songId, marker) {
	return db.marker.create({
		data: {
			marker,
			song: {
				connect: {
					id: songId,
				},
			},
		},
	});
}

/**
 * Get all markers from a song.
 * @param {integer} songId The id of the song to get the markers from.
 * @returns A list of markers.
 */
export async function getMarker(songId) {
	const marker = await db.marker.findMany({
		where: {
			songId,
		},
		select: {
			marker: true,
		},
	});
	return marker.map((marker) => marker.marker);
}
/**
 * Clear all marker from a song.
 * @param {integer} songId The id of the song to remove the markers from.
 */
export function clearMarker(songId) {
	return db.marker.deleteMany({
		where: {
			songId,
		},
	});
}

/**
 * Remove a song from the database.
 * @param {Song} song The song to remove.
 */
async function removeSong(song) {
	const songId = song.id;

	song = await findSong(songId, {
		filename: true,
	});

	if (song === null) return;

	deleteCache(song);

	return db.song.delete({
		where: {
			id: songId,
		},
	});
}

function deleteCache(song) {
	deleteFile(getImagePath(song.filename));
	deleteFile(getImagePath(song.filename, true));
}

function resetCache() {
	return new Promise((resolve, reject) =>
		fs.readdir(process.env.IMAGE_CACHE_PATH, (err, files) => {
			if (err) throw err;

			for (const file of files) {
				fs.unlink(path.join(process.env.IMAGE_CACHE_PATH, file), (err) => {
					if (err) throw err;
				});
			}

			resolve();
		})
	);
}

function deleteFile(file) {
	if (fileExists(file)) {
		fs.unlink(file);
	}
}

async function fileExists(filePath) {
	return new Promise((resolve) =>
		fs.access(filePath, fs.constants.F_OK, (err) => resolve(err === null))
	);
}

async function readFile(file) {
	return new Promise((resolve, reject) =>
		fs.readFile(file, (err, data) => (err ? reject(err) : resolve(data)))
	);
}
/**
 * Removes songs from the database.
 * @param {Song[]} songs The songs to remove.
 * @returns The number of songs removed.
 */
function removeSongs(songs) {
	songs.forEach(deleteCache);

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
 * @param {string} name The filename of the song.
 * @param {boolean} getImage Whether to return the image. If false, only the information if the song has an image is returned.
 */
async function parseSongFromFile(name, getImage = false) {
	const songPath = path.join(process.env.SONGS_PATH, name);

	let metadata = await parseFile(songPath, { skipCovers: !getImage });

	return new Promise((resolve, reject) => {
		fs.stat(songPath, (err, stats) => {
			if (err) return reject(err);

			const modified = stats.mtime;
			const song = {
				title: metadata.common.title || name,
				artist: metadata.common.artist,
				filename: name,
				modified,
			};

			const picture = metadata.common.picture;

			if (getImage && picture) song.image = picture[0].data;
			else song.image = picture != null;

			resolve(song);
		});
	});
}

async function compressImage(image, size = 64) {
	return imagemin.buffer(image, {
		plugins: [
			imageminWebp({ resize: { width: size, height: size }, method: 0 }),
		],
	});
}
/**
 * Gets all file names from the songs folder.
 * @returns A list of filenames.
 */
function getFileNamesFromPath() {
	return new Promise((resolve, reject) =>
		fs.readdir(
			process.env.SONGS_PATH,
			{ withFileTypes: true },
			(err, files) => {
				if (err) return reject(err);
				resolve(files.filter((file) => file.isFile()).map((file) => file.name));
			}
		)
	);
}

/**
 * Adds songs to the database given a list of filenames.
 * @param {string[]} filenames A list of song filenames.
 */
async function addSongsByName(filenames) {
	// Add 10 songs at a time
	const chunkSize = 10;
	for (let i = 0; i < filenames.length; i += chunkSize) {
		const chunk = filenames.slice(i, i + chunkSize);

		const results = await Promise.allSettled(
			chunk.map((filename) => parseSongFromFile(filename))
		);
		const songs = results
			.filter((result) => result.status === "fulfilled")
			.map((result) => result.value);

		await Promise.all(songs.map(add));
	}
}

/**
 * Adds a song to the database given a filename.
 * @param {string} filename The filename of the song.
 */
async function addSongByName(filename) {
	let parsedSong;

	try {
		parsedSong = await parseSongFromFile(filename);
	} catch (e) {
		console.error(e);
	}

	if (!parsedSong) return add({ filename });

	const song = {
		title: parsedSong.title,
		artist: parsedSong.artist,
	};

	return add(song);
}

/**
 * Finds the names of songs that are not in the database.
 * @param {string[]} filenames A list of song filenames. If not provided, it will get all the songs in the songs folder.
 * @returns {string[]} A list of song filenames that are not in the database.
 */
async function findMissingSongs(filenames) {
	const names = filenames || (await getFileNamesFromPath());

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
	const names = filenames || (await getFileNamesFromPath());

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
 * @param {boolean} full Whether to delete all songs before reloading.
 */
export async function reload(full = false) {
	if (full) {
		await db.song.deleteMany({});
		resetCache();
	}

	const songNames = await getFileNamesFromPath();

	const missingSongs = await findMissingSongs(songNames);
	await addSongsByName(missingSongs);

	const orphanedSongs = await findOrphanedSongs(songNames);
	await removeSongs(orphanedSongs);
}
