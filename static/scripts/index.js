const $ = (selector, target) => (target || document).querySelector(selector);

class Song {
	constructor(title, artist, image, modified, id) {
		const api = `${Song.api}/${id}`;

		this.title = title;
		this.artist = artist;
		this.image = image ? `${api}/image` : "assets/placeholder.png";
		this.file = `${api}/file`;
		this.modified = new Date(modified);
		this.marker = undefined;
		this.id = id;
	}

	addMarker(marker) {
		return this.uploadMarkerDelayedAction(
			() => this.marker.push(marker),
			"Marked",
			marker
		);
	}

	clearMarker() {
		return this.uploadMarkerDelayedAction(
			() => (this.marker = []),
			"Cleared",
			"clear"
		);
	}

	getMarker() {
		return this.marker;
	}

	async loadMarker() {
		// if the marker is already loaded, don't load it again
		// this is pulled off by setting the marker to undefined initially,
		// indicating that it hasn't been loaded yet
		if (this.marker) {
			SeekbarManager.loadMarkers();
			return;
		}

		const marker = await ApiManager.getMarker(this.id);

		this.setMarker(marker);
		SeekbarManager.loadMarkers();
	}

	setMarker(marker) {
		this.marker = marker;
	}

	upload(marker) {
		return ApiManager.editSongMarker(this.id, marker);
	}

	/**
	 * Uploads a marker and performs an action on success.
	 * @param {()} action The action to perform on upload success.
	 * @param {*} popupMessage The message to show on upload success.
	 * @param {*} marker The marker to upload.
	 * @returns {Promise} A promise that resolves when the upload is done.
	 */
	uploadMarkerDelayedAction(action, popupMessage, marker) {
		const uploadTime = 20; // assumed ping to prevent the wrong popup from showing up too early

		const timeout = setTimeout(
			() => PopupManager.showPopup(popupMessage),
			uploadTime
		);

		return this.upload(marker)
			.then(() => action())
			.catch(() => {
				clearTimeout(timeout);
				PopupManager.showPopup("Failed");

				return Promise.reject("Failed to upload");
			});
	}

	getFullImage() {
		return this.image + "?full";
	}

	static fromJSON(json) {
		return new Song(
			json.title,
			json.artist,
			json.image,
			json.modified,
			json.id
		);
	}

	static setApi(api) {
		this.api = api;
	}
}

class Action {
	static {
		this.INPUT = "input";
		this.TOGGLE = "toggle";
		this.ACTION = "action";

		this.TOGGLE_ON = true;
		this.TOGGLE_OFF = false;

		this.HIDDEN = "hidden_input";
	}

	constructor(name, action, type = Action.ACTION, update) {
		this.name = name;
		this.action = action;
		this.type = type;

		this.update = update;
		this.updateValue()
	}

	updateValue() {
		this.value = typeof this.update === "function" ? this.update() : this.update;
	}

	select() {
		if (this.type == Action.TOGGLE)
			this.value = !this.value;

		this.action(this)
	}
}

class PopupManager {
	static initialize() {
		this.PERMANENT = -1;

		this.popup = $("#popup");
		this.popupContent = $("#popup-text");
	}

	static showPopup(content, duration = 1000) {
		// Avoid XSS
		if (typeof content === "string")
			this.popupContent.innerText = content;
		else
			this.popupContent.innerHTML = content;

		this.popup.classList.add("popup-active");

		if (duration < 0) return;

		clearTimeout(this.popupActive);
		this.popupActive = setTimeout(
			() => this.popup.classList.remove("popup-active"),
			duration
		);
	}
}

class SeekbarManager {
	static initialize() {
		this.seekbar = $("#seekbar");
		this.marker = $("#marker-template").content.firstElementChild;

		this.progress = $("#seekbar-progress", seekbar);
		this.knob = $("#seekbar-knob", seekbar);
		this.knobCircle = $("#seekbar-knob-circle", this.knob);

		this.currentTime = $("#seekbar-current-time", seekbar);
		this.currentTimeText = $("#seekbar-current-time-text", this.currentTime);
		this.durationText = $(
			"#seekbar-current-song-duration-text",
			this.currentTime
		);

		this.isMouseOverSeekbarProp = false;

		this.markerHoverStyle = document.createElement("style");
		this.markerHoverStyle.type = "text/css";
		this.markerHoverStyle.innerHTML = `.marker {
			 height: 15px !important; 
			 box-shadow: 0 0 20px 3px var(--highlight-yellow) !important;
			}`;

		this.seekbarShrunken = true;
		this.setSmoothProgressBar();

		// the last x position of the mouse on the seekbar
		this.lastProgressX = 0;
		const setProgress = (touch) => {
			if (touch.time - this.lastSetProgressCall < 4) return;
			this.lastSetProgressCall = touch.time;

			if (Math.abs(this.lastProgressX - touch.x) > 20) {
				AudioManager.playInteractionAudio(60);
				this.lastProgressX = touch.x;
			}

			const calculateProgress = touch.x / this.seekbar.offsetWidth;
			SeekbarManager.setProgress(calculateProgress);
			AudioManager.setProgress(calculateProgress);

			PopupManager.showPopup(this.currentTimeText.innerText, 800);
		};

		// update seekbar on mouse events
		// document is used instead of seekbar because the mouse can leave the seekbar
		// and events will stop firing, for that reason mouseDownOriginIsSeekbar is used

		let mouseDownOriginIsSeekbar = false;

		const onSeek = (time, x) => {

			mouseDownOriginIsSeekbar = true;

			AudioManager.pause();

			// Update the progress instantly.
			setProgress({ time, x })

			document.onmousemove = (e) => {
				if (Math.abs(this.lastProgressX - e.clientX) > 20) {
					this.setInstantProgressBar();
				}

				setProgress(e)
			}
		};

		const onSeekStop = (time, x) => {
			this.setSmoothProgressBar();

			if (!mouseDownOriginIsSeekbar) return;
			mouseDownOriginIsSeekbar = false;

			setProgress({ time, x });
			AudioManager.play();

			// if the mouse is over the seekbar, keep the hover effect
			if (!this.isMouseOverSeekbar()) this.shrinkSeekbar();

			document.onmousemove = null;
		};

		const isTouchDevice = 'ontouchstart' in window;

		if (isTouchDevice) {
			this.seekbar.ontouchstart = (e) => onSeek(e.timeStamp, e.changedTouches[0].clientX);
			this.seekbar.addEventListener("touchmove", this.seekbar.ontouchstart);

			this.seekbar.addEventListener("touchend", (e) => onSeekStop(e.timeStamp, e.changedTouches[0].clientX));
		} else {
			this.seekbar.onmousedown = (e) => onSeek(e.timeStamp, e.clientX);
			document.onmouseup = (e) => onSeekStop(e.timeStamp, e.clientX);
		}

		// hover effect

		const onHover = () => {
			this.isMouseOverSeekbarProp = true;
			this.enlargeSeekbar();
		};

		const onHoverStop = () => {
			this.isMouseOverSeekbarProp = false;

			// if the mouse is currently down on seekbar, do not the remove hover effect
			if (!mouseDownOriginIsSeekbar && !AudioManager.isPaused())
				this.shrinkSeekbar();
		};

		if (isTouchDevice) {
			this.seekbar.addEventListener("touchmove", onHover)
			this.seekbar.addEventListener("touchend", onHoverStop)
		} else {
			this.seekbar.onmouseenter = onHover;
			this.seekbar.onmouseleave = onHoverStop;
		}
	}

	static loadMarkers() {
		this.clearSeekbarMarker();

		SongManager.getCurrentSong()
			.getMarker()
			.forEach((marker) => this.addMarkerToSeekbar(marker));
	}

	static setSmoothProgressBar() {
		if (this.smoothSeekbar) return;
		this.smoothSeekbar = true;

		this.progress.classList.add("seekbar-smooth");
	}

	static setInstantProgressBar() {
		if (!this.smoothSeekbar) return;
		this.smoothSeekbar = false;

		this.progress.classList.remove("seekbar-smooth");
	}

	static addMarker() {
		const marker =
			(AudioManager.getCurrentTime() / AudioManager.getDuration()) * 100;

		const song = SongManager.getCurrentSong();
		if (!song) return;

		const markerNode = SeekbarManager.addMarkerToSeekbar(marker);
		song.addMarker(marker).catch(() => markerNode.remove());
	}

	static async clearMarker() {
		const song = SongManager.getCurrentSong();

		if (!song) return;

		if (!song.getMarker().length) return;

		song.clearMarker().then(() => SeekbarManager.clearSeekbarMarker());
	}

	static addMarkerToSeekbar(marker) {
		const markerNode = this.marker.cloneNode(true);
		markerNode.style.left = `${marker}%`;
		this.seekbar.appendChild(markerNode);

		return markerNode;
	}

	static clearSeekbarMarker() {
		this.seekbar
			.querySelectorAll(".marker")
			.forEach((marker) => marker.remove());
	}

	static hideSeekbar() {
		if (!this.seekbarShowing) return;
		this.seekbarShowing = false;

		this.seekbar.classList.add("seekbar-hidden");
	}

	static showSeekbar() {
		if (this.seekbarShowing) return;
		this.seekbarShowing = true;

		this.seekbar.classList.remove("seekbar-hidden");
	}

	static getSeekbar() {
		return this.seekbar;
	}

	static isMouseOverSeekbar() {
		return this.isMouseOverSeekbarProp;
	}

	static enlargeSeekbar() {
		if (!this.seekbarShrunken) return;

		this.currentTime.classList.add("current-time-active");
		this.knobCircle.classList.add("knob-circle-active");
		this.progress.classList.add("seekbar-hover");

		this.seekbar.appendChild(this.markerHoverStyle);

		this.seekbarShrunken = false;
	}

	static shrinkSeekbar() {
		if (this.seekbarShrunken) return;

		this.currentTime.classList.remove("current-time-active");
		this.knobCircle.classList.remove("knob-circle-active");
		this.progress.classList.remove("seekbar-hover");

		this.seekbar.removeChild(this.markerHoverStyle);

		this.seekbarShrunken = true;
	}

	static formatMinutes(time) {
		// get total minutes and seconds
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);

		return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
	}
	/**
	 * @param {number} progress The progress in the range [0, 1].
	 */
	static setProgress(progress) {
		if (progress < 0) progress = 0;
		if (progress > 1) progress = 1;
		this.progress.style.width = progress * 100 + "%";

		const currentTime = AudioManager.getDuration() * progress;

		// Prevent updating the current time too often.
		if (Math.abs(currentTime - this.lastTimeUpdate) < 1) return;
		this.lastTimeUpdate = currentTime;

		this.currentTimeText.innerText = this.formatMinutes(currentTime);
	}

	/**
	 * @param {number} duration The duration in seconds.
	 */
	static setDuration(duration) {
		this.durationText.innerText = this.formatMinutes(duration);
	}
}

class ThemeManager {
	static initialize() {
		const root = document.querySelector(":root");
		const color = localStorage.getItem("highlight") || getComputedStyle(root).getPropertyValue("--highlight");
		this.setTheme(color);
	}

	static setTheme(color) {
		localStorage.setItem("highlight", color);

		const root = document.querySelector(":root");
		root.style.setProperty("--highlight", color);
	}

	static getTheme() {
		return getComputedStyle(document.querySelector(":root")).getPropertyValue("--highlight");
	}

	static rotateTheme() {
		const rotation = Math.round(Math.random() * 360);

		PopupManager.showPopup(rotation);

		this.setTheme(`hsl(${rotation}, 100%, 50%)`);
	}

	static resetTheme() {
		this.setTheme("#FF003D");
	}
}

class EventManager {
	static initialize() {
		document.onkeydown = (e) => {
			switch (e.code) {
				case "ControlLeft":
					this.control = true;
				case "Space":
					this.space = true;
				case "ShiftLeft":
					this.shift = true;
			}

			if (!ApiManager.isConnected()) {
				if (this.control) {
					switch (e.code) {
						case "KeyE":
							e.preventDefault();
							ApiManager.rotateEndpoint();
							return;
						case "KeyR":
							e.preventDefault();
							ApiManager.reloadSongs();
							return;
					}
				}

				return;
			}


			if (!SearchManager.isActive()) {
				e.preventDefault();

				if (this.control) {
					AnimationManager.scaleMain(true);
				}

				switch (e.code) {
					case "ArrowLeft":
						if (this.control) AudioManager.scrub(-20);
						else if (AudioManager.getCurrentTime() < 5) {
							if (this.confirmedPlayPrevious) {
								this.confirmedPlayPrevious = false;
								SongManager.playPreviousSong();
								return;
							}
							else {
								this.confirmedPlayPrevious = true;
								setTimeout(() => this.confirmedPlayPrevious = false, 2000);
								PopupManager.showPopup("Previous?", 2000);
							}
						}

						if (this.shift) AudioManager.scrub(-1);
						else AudioManager.scrub(-5);
						return;
					case "ArrowRight":
						if (this.control) AudioManager.scrub(20);
						else if (this.shift) AudioManager.scrub(1);
						else AudioManager.scrub(5);

						return;
					case "ArrowUp":
						SongManager.selectPrevious();
						return;
					case "ArrowDown":
						SongManager.selectNext();
						return;
					case "Space":
						AudioManager.toggle();
						return;
					case "Enter":
						SongManager.playCurrentSongItem();
						return;
					case "Home":
						PopupManager.showPopup("Start");
						AudioManager.toStart();
						return;
					case "End":
						PopupManager.showPopup("End");
						AudioManager.toEnd();
						return;
					case "PageDown":
						PopupManager.showPopup("Next");
						SongManager.next();
						return;
					case "PageUp":
						PopupManager.showPopup("Previous");
						SongManager.playPreviousSong();
						return;
					default:
						if (e.key >= 0 && e.key <= 9) {
							const index = e.key == 0 ? 10 : (e.key - 1);
							AudioManager.setProgress(index / 10);
							return;
						}
				}

				if (this.control) {
					switch (e.code) {
						case "BracketRight":
							AudioManager.changeVolume(true);
							return;
						case "Slash":
							AudioManager.changeVolume(false);
							return;
						case "KeyA":
							if (
								!SearchManager.isActive() || !SearchManager.isSearchSelected()
							) {
								e.preventDefault();
								AnimationManager.toggleAnimations();
							}
							return;
						case "KeyM":
							e.preventDefault();
							SeekbarManager.addMarker();
							return;
						case "KeyC":
							e.preventDefault();
							SeekbarManager.clearMarker();
							return;
						case "KeyS":
							e.preventDefault();
							SongManager.toggleSortByModifiedDate();
							return;
						case "KeyP":
							e.preventDefault();
							PlayModeManager.rotatePlayMode();
							return;
						case "KeyE":
							e.preventDefault();
							ApiManager.rotateEndpoint();
							return;
						case "KeyR":
							e.preventDefault();
							ApiManager.reloadSongs();
							return;
						case "KeyH":
							e.preventDefault();
							ThemeManager.rotateTheme();
							return;
					}

					return;
				}
			}

			const eligibleToOpenSearch = (e.keyCode >= 48 && e.keyCode <= 90) || e.keyCode == 226;
			if (eligibleToOpenSearch) AudioManager.playTypingAudio();

			// Enter should not select the search input and instead select the current search result
			if (e.code != "Enter")
				SearchManager.selectSearchInput();

			if (SearchManager.isActive()) {
				switch (e.code) {
					case "ArrowUp":
						e.preventDefault();
						SearchManager.selectPrevious();
						return;
					case "ArrowDown":
						e.preventDefault();
						SearchManager.selectNext();
						return;
					case "Enter":
						if (SearchManager.isActionInputMode())
							SearchManager.exitActionInputModeAndToggle();
						else
							SearchManager.selectCurrentResultItem();

						return;
					case "Escape":
						if (SearchManager.isActionInputMode())
							SearchManager.exitActionInputMode();
						else
							SearchManager.toggle();
						return;
				}
			} else {
				if (eligibleToOpenSearch) {
					SearchManager.toggle();
					SearchManager.searchInput.value = e.key;
					SearchManager.updateSearch();
				}
			}

		};

		document.onkeyup = (e) => {
			if (e.code == "Space") this.space = false;
			if (e.code == "ShiftLeft") this.shift = false;
			if (e.code == "ControlLeft") this.control = false;

			if (!ApiManager.isConnected()) return;

			if (!this.control) {
				AnimationManager.scaleMain(false);
			}
		};

		document.oncontextmenu = (e) => e.preventDefault();
	}
}

class ApiManager {
	static initialize() {
		this.apiVersion = 1;

		this.defaultEndpoints = ["https://demomusicapi.osumatrix.me", "http://localhost:3000"];
		this.endpoints = this.loadEndpoints() || this.defaultEndpoints;
		this.currentEndpoint = this.getCurrentEndpoint();

		this.currentEndpointIndex = 0;

		this.sendOption = (method = "POST") => ({
			method,
			headers: {
				"Content-Type": "application/json",
			},
		});

		Song.setApi(`${this.getApi()}/songs`);
	}

	static setAuthorizationToken(token) {
		let name = window.location.hostname;
		const parts = name.split(".");
		if (parts.length > 1) name = parts.slice(-2).join(".");

		document.cookie = `authorization=${token};domain=.${name};max-age=31536000`;
	}

	// TODO: Add frontend for this
	static saveEndpoints() {
		localStorage.setItem("endpoints", JSON.parse(this.endpoints));
	}

	static loadEndpoints() {
		const endpoints = localStorage.getItem("endpoints");
		if (endpoints == null) return null;

		this.endpoints = JSON.parse(localStorage.getItem("endpoints"));
	}

	// TODO: Add frontend for this
	static addEndpoint(endpoint) {
		this.endpoints.push(endpoint);
		this.saveEndpoints();
	}

	// TODO: Add frontend for this
	static resetEndpoints() {
		this.endpoints = this.defaultEndpoints;
	}

	static rotateEndpoint() {
		this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;

		this.setAndSaveEndpoint(this.endpoints[this.currentEndpointIndex]);
	}

	static setAndSaveEndpoint(endpoint) {
		this.setEndpoint(endpoint);
		this.saveCurrentEndpoint();
	}

	static getCurrentEndpoint() {
		const endpoint = localStorage.getItem("currentEndpoint");
		return endpoint == null ? this.endpoints[0] : endpoint;
	}

	static saveCurrentEndpoint() {
		localStorage.setItem("currentEndpoint", this.currentEndpoint);
	}

	static setEndpoint(endpoint) {
		if (this.currentEndpoint == endpoint) return;
		this.currentEndpoint = endpoint;

		PopupManager.showPopup(endpoint);
	}

	static async reloadSongs() {
		PopupManager.showPopup("Reloading");

		await this.request("/songs/reload", this.sendOption()).catch(() => { });

		AnimationManager.turnOff();
		setTimeout(() => {
			window.location.reload();
		}, 1000);
	}

	// TODO: make use of limit and offset
	static async querySongs(query, limit = 20, offset = 0) {
		const songs = await this.request(
			`/songs?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
		);

		const ids = [];
		for (const song of songs) ids.push(song.id);

		return ids;
	}

	// TODO: implement frontend for this
	static watchForChanges(watch) {
		return this.request(
			"/songs/watch" + watch ? "?watch" : "",
			this.sendOption()
		);
	}

	static async getMarker(id) {
		return await this.request(`/songs/${id}/marker`);
	}

	static async getRandomSong() {
		const json = await this.request(`/songs/random`);
		return Song.fromJSON(json);
	}
	static async getSongs(ids) {
		const json = await this.request(`/songs/multiple`, {
			...this.sendOption(),
			body: JSON.stringify({ ids }),
		});

		const songs = [];
		for (const song of json) {
			songs.push(Song.fromJSON(song));
		}

		return songs;
	}

	static async getSong(id) {
		const json = await this.request(`/songs/${id}`);
		return Song.fromJSON(json);
	}

	static async getSongIds(offset, sortByModifiedDate) {
		const ids = [];

		let api = `/songs/offset/${offset}`;
		if (sortByModifiedDate) api += "?sortByModifiedDate";

		const response = await this.request(api);
		response.forEach((song) => ids.push(song.id));

		return ids;
	}

	static async editSongMarker(id, marker) {
		return this.request(`/songs/${id}/marker`, {
			...this.sendOption("PATCH"),
			body: JSON.stringify({ marker }),
		});
	}

	static async ping() {
		return this.request("/").then(() => this.connected = true)
	}

	static isConnected() {
		return this.connected;
	}

	static getApi() {
		return `${this.currentEndpoint}/api/v${this.apiVersion}`;
	}

	static async request(api, options) {
		const response = await fetch(`${this.getApi()}${api}`, {
			credentials: 'include',
			...options
		});

		if (!response.ok) return Promise.reject(response.status);

		return response.json();
	}
}

class PlayModeManager {
	static initialize() {
		this.AUTOPLAY = 0;
		this.SHUFFLE = 1;
		this.REPEAT = 2;
		this.ONCE = 3;

		this.playModes = new Map([
			[this.AUTOPLAY, "Autoplay"],
			[this.SHUFFLE, "Shuffle"],
			[this.REPEAT, "Repeat"],
			[this.ONCE, "Once"],
		]);

		this.currentPlayMode = parseInt(localStorage.getItem("playMode")) || 0;
	}

	static getCurrentPlayMode() {
		return this.currentPlayMode;
	}

	static rotatePlayMode() {
		this.currentPlayMode = (this.currentPlayMode + 1) % this.playModes.size; // rotate play mode

		localStorage.setItem("playMode", this.currentPlayMode);

		const playMode = this.playModes.get(this.currentPlayMode);
		PopupManager.showPopup(playMode);
	}
}

class SongManager {
	static initialize() {
		this.history = [];
		this.image = $("#image");
		this.songList = $("#song-list");
		this.songItem = $("#song-item-template").content.firstElementChild;

		this.songs = new Map();

		this.currentSongItem = null;
		this.currentSong = null;

		this.offset = 0;

		this.selectPrevNextWaitTime = 100;

		this.sortByModifiedDate =
			localStorage.getItem("sortByModifiedDate") || true;

		// handle song playback
		this.songList.onclick = (e) => {
			if (e.target.classList.contains("song-item")) {
				this.setActive(e.target);
				this.playSongItem(e.target);
				this.scrollToCurrentSongItem();
			}
		};

		this.songList.onscroll = (e) => {
			clearTimeout(this.scrollTimeout);
			this.scrollTimeout = setTimeout(() => {
				if (
					e.target.scrollTop + e.target.clientHeight >=
					e.target.scrollHeight -
					(e.target.scrollHeight - e.target.scrollTop) / 2
				)
					SongManager.getNewSongs();
			}, 5);
		};

		this.image.onclick = () => {
			AudioManager.toggle();
		};

		this.getNewSongs()
	}

	static async next() {
		switch (PlayModeManager.getCurrentPlayMode()) {
			case PlayModeManager.AUTOPLAY:
				SongManager.selectNextAndPlay();
				break;
			case PlayModeManager.SHUFFLE:
				const song = await ApiManager.getRandomSong();
				SongManager.add(song);
				SongManager.playSongAndSetActive(song);
				break;
			case PlayModeManager.REPEAT:
				SongManager.playSong(SongManager.getCurrentSong());
				break;
		}
	}

	static isSortedByModifiedDate() {
		return this.sortByModifiedDate;
	}

	static async toggleSortByModifiedDate() {
		this.sortByModifiedDate = !this.sortByModifiedDate;
		localStorage.setItem("sortByModifiedDate", this.sortByModifiedDate);

		this.songList.innerHTML = "";
		this.offset = 0;

		this.songs.clear(); // sadly required, otherwise songs will not be added

		this.getNewSongs().then(() =>
			PopupManager.showPopup(
				"Date " + (this.sortByModifiedDate ? "modified" : "added")
			)
		);
	}

	static getImage() {
		return this.image;
	}

	// TODO: this method adds songs to the song list, when new songs are loaded
	//  order of songs is not guaranteed, this should be fixed
	static async getSongs(ids) {
		const songs = [];

		// record ids of songs not in cache
		let missingSongs = [];

		// add songs from cache
		for (const id of ids) {
			if (this.songs.has(id)) songs.push(this.songs.get(id));
			else missingSongs.push(id);
		}

		if (missingSongs.length == 0) return songs;

		let newSongs = await ApiManager.getSongs(missingSongs);

		if (this.sortByModifiedDate)
			newSongs = newSongs.sort((a, b) => b.modified - a.modified);

		// add newly found songs to cache
		for (const song of newSongs) {
			this.add(song);

			// merge with songs from cache
			songs.push(song);
		}

		return songs;
	}

	static add(song) {
		if (this.songs.has(song.id)) return;

		this.songs.set(song.id, song);
		this.addSongToList(song);
	}

	static async getNewSongs() {
		if (this.offset == -1) return; // no more songs to load (end of list

		const ids = await ApiManager.getSongIds(
			this.offset,
			this.sortByModifiedDate
		);

		if (ids.length == 0) {
			this.offset = -1; // no more songs to load (end of list)
			return;
		}

		this.offset = this.sortByModifiedDate
			? this.offset + 1 // if sorting by modified date, paginate by 1
			: ids[ids.length - 1] + 1; // otherwise, paginate by last id

		const songs = this.getSongs(ids);
		return songs;
	}

	static async querySongs(query) {
		const ids = await ApiManager.querySongs(query);

		if (ids.length == 0) return [];

		const newSongs = this.getSongs(ids);
		return newSongs;
	}

	static playPreviousSong() {
		if (this.history.length <= 1) {
			AudioManager.toStart();
			AudioManager.scrub(-1);
			return;
		}

		this.history.pop(); // Remove current song.

		this.playSongAndSetActive(this.history.pop()); // Play previous song.
	}

	static playSongAndSetActive(song) {
		this.playSong(song);
		this.setActiveById(song.id);
	}

	static playSong(song) {
		if (this.history[this.history.length - 1] != song)
			this.history.push(song);

		this.currentSong = song;
		this.currentSong.loadMarker();

		this.image.src = this.currentSong.getFullImage();

		AudioManager.setSong(this.currentSong);
		AudioManager.play();

		SeekbarManager.toString();
		SeekbarManager.showSeekbar();

		document.title = `${song.artist} - ${song.title}`;
		$("link[rel='icon']").href = song.image;

	}

	static playSongId(id) {
		const song = this.songs.get(parseInt(id));

		this.playSong(song);
	}

	static playSongItem(songItem) {
		this.playSongId(songItem.id);
	}

	static scrollToCurrentSongItem() {
		this.currentSongItem.scrollIntoView({
			behavior: "smooth",
			block: "center",
			inline: "center",
		});
	}

	static getCurrentSong() {
		return this.currentSong;
	}

	static setActive(songItem) {
		if (this.currentSongItem)
			this.currentSongItem.classList.remove("song-item-active");

		this.currentSongItem = songItem;
		if (songItem) {
			this.currentSongItem.classList.add("song-item-active");
			this.currentSongItem.scrollIntoViewIfNeeded(true);
		}
	}

	static setActiveById(id) {
		const songItem = $("#" + CSS.escape(id), this.songList);
		this.setActive(songItem);
	}

	static selectNext() {
		if (Date.now() - this.selectNextTimeout < this.selectPrevNextWaitTime)
			return;
		this.selectNextTimeout = Date.now();

		let next;
		if (this.currentSongItem) {
			next = this.currentSongItem.nextElementSibling;

			// if there is no next song, play the first song
			if (!next) next = this.songList.firstElementChild;
		} else {
			next = this.songList.firstElementChild;
		}

		this.setActive(next);
		this.scrollToCurrentSongItem();
	}

	static selectNextAndPlay() {
		this.selectNext();
		this.playCurrentSongItem();
	}

	static selectPrevious() {
		if (Date.now() - this.selectPreviousTimeout < this.selectPrevNextWaitTime)
			return;
		this.selectPreviousTimeout = Date.now();

		let next;
		if (this.currentSongItem) {
			next = this.currentSongItem.previousElementSibling;
			if (!next) next = this.songList.lastElementChild;
		} else {
			next = this.songList.lastElementChild;
		}

		this.setActive(next);
		this.scrollToCurrentSongItem();
	}

	static playCurrentSongItem() {
		if (this.currentSongItem)
			this.playSongItem(this.currentSongItem);
	}

	static createSongItem(song) {
		const songItem = this.songItem.cloneNode(true);

		songItem.id = song.id;

		$(".song-title", songItem).innerText = song.title;
		$(".song-artist", songItem).innerText = song.artist;
		$(".song-image", songItem).src = song.image;

		return songItem;
	}

	static addSongToList(song) {
		const songItem = SongManager.createSongItem(song);
		SongManager.songList.appendChild(songItem);
	}
}

class AudioManager {
	static initialize() {
		this.imagePaused = false;

		this.songAudio = new Audio();

		this.interactionAudio = new Audio("assets/interaction.wav");

		this.keys = [...Array(4)].map((_, i) => new Audio(`assets/key${i}.mp3`));

		this.setVolume(localStorage.getItem("volume") || 50);

		this.songAudio.onplay = () => {
			if (this.songAudio.readyState == 0) this.pauseImage();
			else this.resumeImage();
		};
		this.songAudio.onpause = () => this.pauseImage();
		this.songAudio.onended = async () => {
			this.pauseImage();
			LastFMManager.resetLast();
			await SongManager.next();
		}
		this.songAudio.addEventListener("loadedmetadata", () => this.resumeImage());

		// update seekbar on audio events

		this.songAudio.addEventListener("loadedmetadata", () =>
			SeekbarManager.setDuration(this.getDuration())
		);

		const updateSeekbar = () => {
			SeekbarManager.setProgress(this.getCurrentTime() / this.getDuration());

			requestAnimationFrame(updateSeekbar);
		};
		requestAnimationFrame(updateSeekbar);

		const changeVolume = (e) => AudioManager.changeVolume(e.deltaY < 0);

		SeekbarManager.getSeekbar().onwheel = changeVolume;
		SongManager.getImage().onwheel = changeVolume;
	}

	static toStart() {
		this.setProgress(0);
	}

	static toEnd() {
		this.setProgress(1);
	}

	static pauseImage() {
		if (this.imagePaused) return;

		SongManager.getImage().classList.add("image-paused");

		this.imagePaused = true;
	}

	static resumeImage() {
		if (!this.imagePaused) return;

		SongManager.getImage().classList.remove("image-paused");

		this.imagePaused = false;
	}

	static playInteractionAudio(wait = 0) {
		if (Date.now() - this.lastInteractionAudioPlay < wait) return;
		this.lastInteractionAudioPlay = Date.now();

		this.playAudio(this.interactionAudio);
	}

	static playTypingAudio() {
		this.playAudio(this.keys[Math.floor(Math.random() * this.keys.length)], 0.5);
	}

	static playAudio(audio, volumeMultiplier = 1) {
		audio.volume = (this.getVolume() / 100) * volumeMultiplier;
		audio.currentTime = 0;
		audio.play();
	}

	static changeVolume(increase = true) {
		let delta;

		let currentVolume = AudioManager.getVolume();
		if (increase) {
			delta = currentVolume < 5 ? 1 : 5;
		} else {
			delta = currentVolume <= 5 ? -1 : -5;
		}

		AudioManager.addVolume(delta);
	}

	/**
	 * @param {Song} song The song to play.
	 */
	static setSong(song) {
		this.songAudio.src = song.file;
	}

	static play() {
		if (this.songAudio.src) {
			this.songAudio.play();
			LastFMManager.updateNowPlaying(SongManager.getCurrentSong());

			// TODO: Properly scrobble by checking if the song has been actually played for 50% or 4 minutes
			this.songAudio.ontimeupdate = () => {
				if (this.songAudio.currentTime < 30) return;

				// AudioManager.toEnd() should not trigger scrobble
				if (this.songAudio.currentTime == this.getDuration()) return;

				if (this.songAudio.currentTime >= this.songAudio.duration / 2 || this.songAudio.currentTime >= 4 * 60) {
					LastFMManager.scrobble(SongManager.getCurrentSong());
					this.songAudio.ontimeupdate = null;
				}
			}
		}

		else SongManager.selectNextAndPlay();
	}

	static getVolume() {
		return Math.round(this.songAudio.volume * 100);
	}

	static addVolume(amount) {
		this.setVolume(this.getVolume() + amount);
		this.playInteractionAudio();

		AudioManager.showVolumePopup();
	}

	static setVolume(volume) {
		if (volume < 0) volume = 0;
		else if (volume > 100) volume = 100;

		localStorage.setItem("volume", volume);

		this.songAudio.volume = volume / 100;
	}

	static showVolumePopup() {
		PopupManager.showPopup(this.getVolume() + "%");
	}

	static pause() {
		this.songAudio.pause();
	}

	static isPaused() {
		return this.songAudio.paused;
	}

	static toggle() {
		if (this.isPaused()) {
			this.play();

			if (!SeekbarManager.isMouseOverSeekbar()) SeekbarManager.shrinkSeekbar();
		} else {
			this.pause();

			SeekbarManager.enlargeSeekbar();
		}
	}

	static getDuration() {
		return this.songAudio.duration || 0;
	}

	static getCurrentTime() {
		return this.songAudio.currentTime;
	}

	/**
	 * @param {number} progress The progress in the range [0, 1].
	 */
	static setProgress(progress) {
		this.songAudio.currentTime = this.getDuration() * progress;
	}

	static scrub(seconds) {
		// prevent glitching sound by pausing and playing the audio after scrubbing stops
		this.pause();

		clearTimeout(this.scrubTimeout);
		this.scrubTimeout = setTimeout(() => this.play(), 100);

		this.songAudio.currentTime += seconds;
	}
}

class LastFMManager {
	static initialize() {
		this.apiKey = localStorage.getItem("lastfm-api-key")
		this.apiSecret = localStorage.getItem("lastfm-api-secret")
		this.session = JSON.parse(localStorage.getItem("lastfm-session"))

		this.lastfm = new LastFM({
			cache: new LastFMCache(),
			apiKey: this.apiKey,
			apiSecret: this.apiSecret,
		});

		if (this.session) this.authed = true;
	}

	static auth(apiKey, apiSecret) {
		if (apiKey) {
			this.lastfm.setApiKey(apiKey);
			localStorage.setItem("lastfm-api-key", apiKey);
			this.apiKey = apiKey;
		}
		if (apiSecret) {
			this.lastfm.setApiSecret(apiSecret);
			localStorage.setItem("lastfm-api-secret", apiSecret);
			this.apiSecret = apiSecret;
		}

		this.lastfm.auth.getToken({
			success: (data) => {
				window.open(`https://www.last.fm/api/auth?api_key=${this.apiKey}&token=${data.token}`, "_blank");
				localStorage.setItem("lastfm-token", data.token);

				var attemptsLeft = 10;
				clearInterval(this.authAttempt);
				this.authAttempt = setInterval(() => {
					this.lastfm.auth.getSession({
						token: data.token,
					}, {
						success: (data) => {
							localStorage.setItem("lastfm-session", JSON.stringify(data.session));
							this.session = data.session;
							PopupManager.showPopup("Last.FM authenticated", 2000);
							this.authed = true;
							clearInterval(this.authAttempt);
						}
					})

					if (attemptsLeft-- == 0) {
						this.warnNotAuthed();
						clearInterval(this.authAttempt);
					}
				}, 5000);
			}
		})
	}

	static updateNowPlaying(song) {
		if (!this.authed) return this.warnNotAuthed();

		if (this.lastPlaying == song) return;
		this.lastPlaying = song;

		this.lastfm.track.updateNowPlaying({ artist: song.artist, track: song.title }, this.session);
		this.timestamp = Math.floor(Date.now() / 1000);
	}

	static resetLast() {
		this.lastScrobble = null;
		this.lastPlaying = null;
	}

	static scrobble(song) {
		if (!this.authed) return this.warnNotAuthed();

		if (this.lastScrobble == song) return;
		this.lastScrobble = song;

		this.lastfm.track.scrobble({ artist: song.artist, track: song.title, timestamp: this.timestamp }, this.session);
	}

	static warnNotAuthed() {
		if (this.showedWarning) return;
		PopupManager.showPopup("Last.FM not authenticated", 2000);
		this.showedWarning = true;
	}
}

class ActionManager {
	static initialize() {
		this.actions = [
			new Action("Play", () => AudioManager.play(), Action.ACTION, "Play the current song"),
			new Action("Pause", () => AudioManager.pause(), Action.ACTION, "Pause the current song"),
			new Action("Endpoint", (a) => ApiManager.setAndSaveEndpoint(a.value), Action.INPUT, () => ApiManager.getCurrentEndpoint()),
			new Action("Animations", () => AnimationManager.toggleAnimations(), Action.TOGGLE, () => AnimationManager.isAnimationsEnabled() ? Action.TOGGLE_ON : Action.TOGGLE_OFF),
			new Action("Auth", (a) => ApiManager.setAuthorizationToken(a.value), Action.INPUT, Action.HIDDEN),
			new Action("Theme", (a) => ThemeManager.setTheme(a.value), Action.INPUT, () => ThemeManager.getTheme()),
			new Action("Last.FM (Input format: <key> <secret>)", (a) => {
				const [apiKey, apiSecret] = a.value.split(" ");
				LastFMManager.auth(apiKey, apiSecret);
			}, Action.INPUT, Action.HIDDEN),
		];

		this.actionsByName = new Map();
		this.actions.forEach((action) => this.actionsByName.set(action.name, action));
	}

	static queryActions(query) {
		query = query.toLowerCase();

		const actions = [];

		this.actions.forEach((action) => {
			if (action.name.toLowerCase().includes(query)) {
				action.updateValue();
				actions.push(action);
			}
		});

		return actions;
	}

	static getAction(name) {
		return this.actionsByName.get(name);
	}

	static updateActionInput(action, value) {
		action.value = value;
	}


	save(action) {
		localStorage.setItem(`action-${action.name}`, action.value);
	}

	restore(action) {
		action.value = localStorage.getItem(`action-${action.name}`);
	}
}

class SearchManager {
	static initialize() {
		this.searchInputIsSelected = false;
		this.visible = false;
		this.search = $("#search-main");
		this.searchContainer = $("#search-container", this.search);
		this.searchInput = $("#search-input", this.search);

		this.results = $("#search-results");
		this.songResultItem = $("#search-result-song-item-template").content.firstElementChild;
		this.actionResultItem = $("#search-result-action-item-template").content.firstElementChild;
		this.currentResultItem = null;

		this.searchInput.onfocus = () => (this.searchInputIsSelected = true);
		this.searchInput.onblur = () => (this.searchInputIsSelected = false);

		this.actionInputMode = false

		this.results.onclick = (e) => {
			if (e.target == this.results) return;

			if (SearchManager.isActionInputMode())
				SearchManager.exitActionInputModeAndToggle();
			else
				this.selectItem(e.target);
		};

		this.search.onclick = (e) => {
			if (e.target != this.search && e.target != this.searchContainer) return;
			SearchManager.toggle();
		};

		this.searchInput.addEventListener("input", this.updateSearch);
	}

	static enterActionInputMode(action) {
		this.actionInputMode = true;
		this.currentAction = action;
		this.lastSearchInputValue = this.searchInput.value;

		this.clearSearchInput();
		this.selectSearchInput();

		if (action.value != Action.HIDDEN)
			this.searchInput.value = action.value;
	}

	static exitActionInputModeAndToggle() {
		SearchManager.toggle();
	}

	static exitActionInputMode(select = false) {
		if (!this.isActionInputMode()) return;

		if (select)
			this.currentAction.select();
		this.actionInputMode = false;
		this.currentAction = null;
		this.searchInput.value = this.lastSearchInputValue;
	}


	static isActionInputMode() {
		return this.actionInputMode;
	}

	static updateSearch() {
		if (SearchManager.isActionInputMode()) {
			ActionManager.updateActionInput(SearchManager.currentAction, SearchManager.searchInput.value);
			SearchManager.updateCurrentActionResultItemValue();
			return;
		}
		// prevent searching for empty string
		if (SearchManager.searchInput.value.length == 0) {
			clearTimeout(this.searchTimeout);
			SearchManager.clearResults();
			return;
		}

		if (SearchManager.searchInput.value.startsWith(">")) {
			SearchManager.clearResults();

			ActionManager
				.queryActions(SearchManager.searchInput.value.slice(1))
				.forEach((action) => {
					SearchManager.addActionResult(action);
				});

			SearchManager.selectNext();
		} else {

			clearTimeout(this.searchTimeout);
			this.searchTimeout = setTimeout(() => {
				SongManager.querySongs(SearchManager.searchInput.value).then((found) => {
					SearchManager.clearResults();

					if (SongManager.isSortedByModifiedDate()) {
						found = found.sort((a, b) => b.modified - a.modified);
					}
					found.forEach((song) => SearchManager.addSongResult(song));

					SearchManager.selectNext();
				});
			}, 200);
		}
	}

	static selectItem(item) {
		if (item.classList.contains("action")) {
			this.selectAction(item.name);
			this.setActive(item);
		} else
			this.playResult(item);
	}

	static selectCurrentResultItem() {
		this.selectItem(this.currentResultItem);
	}

	static updateCurrentActionResultItemValue() {
		$(".search-result-action-value", this.currentResultItem).innerText = SearchManager.searchInput.value;
	}

	static selectAction(name) {
		const action = ActionManager.getAction(name);

		switch (action.type) {
			case Action.INPUT:
				this.enterActionInputMode(action);
				break;
			default:
				action.select();
				SearchManager.toggle();
		}
	}

	static playResult(resultItem) {
		// Unset song from song list, otherwise we need to search for it.
		SongManager.setActiveById(resultItem.id);
		SongManager.playSongId(resultItem.id);
		SearchManager.toggle();
	}

	static setActive(resultItem) {
		if (resultItem) this.unselectSearchInput();
		else this.selectSearchInput();

		if (this.currentResultItem)
			this.currentResultItem.classList.remove("search-result-item-active");

		if (resultItem) resultItem.classList.add("search-result-item-active");

		this.currentResultItem = resultItem;

		this.currentResultItem?.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
	}

	static selectSearchInput() {
		this.searchInput.focus();
	}

	static unselectSearchInput() {
		this.searchInput.blur();
	}

	static selectNext() {
		this.exitActionInputMode()

		let next;
		if (this.currentResultItem) {
			next = this.currentResultItem.nextElementSibling;

			if (!next) {
				this.setActive(null);
				return;
			}
		} else next = this.results.firstElementChild;

		this.setActive(next);
	}

	static selectPrevious() {
		this.exitActionInputMode()

		let next;
		if (this.currentResultItem) {
			next = this.currentResultItem.previousElementSibling;

			if (!next) {
				this.setActive(null);
				return;
			}
		} else next = this.results.lastElementChild;

		this.setActive(next);
	}
	static addActionResult(action) {
		const resultItem = this.actionResultItem.cloneNode(true);

		resultItem.name = action.name;

		$(".search-result-action-name", resultItem).innerText = action.name;
		$(".search-result-action-value", resultItem).innerText = action.value == Action.HIDDEN ? "Hidden" : action.value;

		this.results.appendChild(resultItem);
	}

	static addSongResult(song) {
		const resultItem = this.songResultItem.cloneNode(true);

		resultItem.id = song.id;

		$(".search-result-song-image", resultItem).src = song.image;
		$(".search-result-song-title", resultItem).innerText = song.title;
		$(".search-result-song-artist", resultItem).innerText = song.artist;

		this.results.appendChild(resultItem);
	}

	static clearResults() {
		this.currentResultItem = null;
		this.results.innerHTML = "";
	}

	static isSearchSelected() {
		return this.searchInputIsSelected;
	}

	static isActive() {
		return this.visible;
	}

	static toggle() {
		if (this.visible) {
			this.search.classList.remove("search-active");
			this.exitActionInputMode(true)

			// wait for animation to finish
			setTimeout(() => {
				this.clearSearchInput();
				this.clearResults();
			}, 100);
		} else {
			this.search.classList.add("search-active");
		}

		this.visible = !this.visible;
	}

	static clearSearchInput() {
		this.searchInput.value = "";
	}
}

class AnimationManager {
	static initialize() {
		this.main = $("#main");
		this.animationsEnabled = localStorage.getItem("animations") === "true";
		if (this.animationsEnabled == null) this.animationsEnabled = true;
		this.image = $("#image");
		this.breathingAnimationInterval = null;

		this.animateImage = (x, y) => image.style.transform = `perspective(600px) translate(${x * 16}px, ${y * 16}px) rotateX(${-y}deg)  rotateY(${x}deg) rotate(${x * y * 0.8}deg)`;

		let time = 0;
		this.breathingAnimation = () => {
			if (this.isMouseOnImage || AudioManager.isPaused()) return;

			time += 0.2;

			this.animateImage(
				Math.sin(time) * 0.5,
				Math.cos(time / 2) * 0.5
			);
		};

		this.imageOnMouseMove = (e) => {
			if (e.timeStamp - this.lastMouseMoveCall < 100) return;
			this.lastMouseMoveCall = e.timeStamp;

			const imagePosition = image.getBoundingClientRect();

			const absoluteMouseX = e.pageX - imagePosition.left
			const relativeMouseX = absoluteMouseX / imagePosition.width
			const normalizedMouseX = (relativeMouseX - 0.5) * 2

			const absoluteMouseY = e.pageY - imagePosition.top
			const relativeMouseY = absoluteMouseY / imagePosition.height
			const normalizedMouseY = (relativeMouseY - 0.5) * 2

			this.animateImage(normalizedMouseX, normalizedMouseY);
		};

		this.imageOnMouseOut = () => {
			image.style.transform = "translate(0px, 0px)";
		};

		this.imageOnMouseMoveTouch = (e) => this.imageOnMouseMove(this.transformTouchEvent(e));
		this.imageOnMouseMoveOutTouch = (e) => this.imageOnMouseOut(this.transformTouchEvent(e));

		const setMouseOnImageTrue = () => (this.isMouseOnImage = true);
		const setMouseOnImageFalse = () => (this.isMouseOnImage = false);

		this.isTouchDevice = "ontouchstart" in window;

		if (this.isTouchDevice) {
			this.image.addEventListener("touchstart", setMouseOnImageTrue);
			this.image.addEventListener("touchend", setMouseOnImageFalse);
		} else {
			image.onmouseenter = setMouseOnImageTrue
			image.onmouseleave = setMouseOnImageFalse
		}

		if (this.animationsEnabled) this.start();
	}

	static turnOff() {
		document.body.style.opacity = 0;
	}

	static scaleMain(fade) {
		if (fade) {
			this.main.style.scale = 0.99;
		}
		else {
			this.main.style.scale = 1;
		}
	}

	static stop() {
		this.imageOnMouseOut();

		if (this.isTouchDevice) {
			this.image.removeEventListener("touchmove", this.imageOnMouseMoveTouch);
			this.image.removeEventListener("touchend", this.imageOnMouseMoveOutTouch);
		} else {
			this.image.onmousemove = null;
			this.image.onmouseout = null;
		}

		clearInterval(this.breathingAnimationInterval);
	}

	static transformTouchEvent(e) {
		const changedTouches = e.changedTouches[0];

		return {
			pageX: changedTouches.pageX,
			pageY: changedTouches.pageY,
			timeStamp: e.timeStamp
		}
	}

	static start() {
		this.stop();

		if (this.isTouchDevice) {
			this.image.ontouchmove = this.imageOnMouseMoveTouch;
			this.image.addEventListener("touchend", this.imageOnMouseMoveOutTouch);
		} else {
			this.image.onmousemove = this.imageOnMouseMove;
			this.image.onmouseout = this.imageOnMouseOut;
		}
		this.breathingAnimationInterval = setInterval(
			this.breathingAnimation,
			1000 / 4
		);
	}

	static isAnimationsEnabled() {
		return this.animationsEnabled;
	}

	static toggleAnimations() {
		if (this.animationsEnabled = !this.animationsEnabled) this.start();
		else this.stop();

		PopupManager.showPopup(
			"Animations " + (this.isAnimationsEnabled() ? "enabled" : "disabled")
		);

		if (this.isAnimationsEnabled()) {
			this.start();
		} else {
			this.stop();
		}

		localStorage.setItem("animations", this.isAnimationsEnabled());
	}
}

const initialize = (managers) => managers.forEach((manager) => manager.initialize());

ApiManager.initialize();
ApiManager.ping().then(() =>
	initialize([
		PopupManager,
		LastFMManager,
		SeekbarManager,
		SongManager,
		AudioManager,
		EventManager,
		ActionManager,
		PlayModeManager,
		SearchManager,
		AnimationManager,
		ThemeManager,
	])
).catch((e) => {
	console.log(e)

	// Minimum initialization after failure to connect to the API.
	initialize([
		EventManager,
		PopupManager,
	]);

	PopupManager.showPopup("Disconnected", PopupManager.PERMANENT);
})
