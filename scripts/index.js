const $ = (selector, target) => (target || document).querySelector(selector);

class Song {
	constructor(name, artist, image, url, id) {
		this.name = name;
		this.artist = artist;
		this.image = image;
		this.url = url;
		this.id = id;

		this.marker = [];
	}

	addMarker(marker) {
		this.marker.push(marker);

		this.upload().then(() => {
			PopupManager.showPopup("Added marker", 400);
		});
	}

	deleteMarker() {
		this.marker = [];

		this.upload().then(() => {
			PopupManager.showPopup("Cleared marker", 400);
		});
	}

	async upload() {
		await ApiManager.editSong(this.id);
	}

	getMarker() {
		return this.marker;
	}

	addDuration(to) {
		// TODO: remove this check if all songs have a duration
		if (this.duration) {
			const minutes = AudioManager.formatMinutes(song.duration);
			to.innerText = minutes;
		}
	}

	static fromJSON(json) {
		return new Song(json.name, json.artist, json.image, json.url, json.id);
	}
}

class PopupManager {
	static {
		this.popup = $("#popup");
		this.popupText = $("#popup-text");
	}

	static showPopup(text, duration = 400) {
		// show popup
		this.popupText.innerText = text;

		this.popup.classList.add("popup-active");

		clearTimeout(this.popupActive);
		this.popupActive = setTimeout(
			() => this.popup.classList.remove("popup-active"),
			duration
		);
	}
}
class AudioManager {
	static {
		this.audio = new Audio();
		this.setVolume(localStorage.getItem("volume") || 50);

		// update seekbar on audio events

		this.audio.onloadedmetadata = () =>
			SeekbarManager.setDuration(this.getDuration());

		this.audio.ontimeupdate = () => {
			if (this.audio.readyState > 0)
				SeekbarManager.setProgress(this.getCurrentTime() / this.getDuration());
		};

		this.audio.onended = () => {
			if (SongManager.isAutoplayEnabled()) SongManager.playNext();
		};
	}

	/**
	 * @param {Song} song The song to play.
	 */
	static setSong(song) {
		this.audio.src = song.url;
	}

	static play() {
		if (this.audio.src) this.audio.play();
		else SongManager.playNext();
	}

	static getVolume() {
		return Math.round(this.audio.volume * 100);
	}

	static addVolume(amount) {
		this.setVolume(this.getVolume() + amount);
	}

	static setVolume(volume) {
		// prevent illegal values
		if (volume < 0) volume = 0;
		else if (volume > 100) volume = 100;

		localStorage.setItem("volume", volume);

		// set volume

		this.audio.volume = volume / 100;
	}

	static showVolumePopup() {
		PopupManager.showPopup(this.getVolume() + "%");
	}

	static pause() {
		this.audio.pause();
	}

	static isPaused() {
		return this.audio.paused;
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
		return this.audio.duration || 0;
	}

	static getCurrentTime() {
		return this.audio.currentTime;
	}

	/**
	 * @param {number} progress The progress in the range [0, 1].
	 */
	static setProgress(progress) {
		this.audio.currentTime = this.getDuration() * progress;
	}

	static scrub(seconds) {
		// prevent glitching sound by pausing and playing the audio after scrubbing stops
		this.pause();

		clearTimeout(this.scrubTimeout);
		this.scrubTimeout = setTimeout(() => this.play(), 100);

		this.audio.currentTime += seconds;
	}
}

class SeekbarManager {
	static {
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

		// update seekbar on mouse events
		// document is used instead of seekbar because the mouse can leave the seekbar
		// and events will stop firing, for that reason mouseDownOriginIsSeekbar is used

		const setProgress = (e) => {
			if (e.timeStamp - this.lastSetProgressCall < 4) return;
			this.lastSetProgressCall = e.timeStamp;

			// get current mouse position in x axis of screen

			const calculateProgress = (e) => e.clientX / this.seekbar.offsetWidth;
			AudioManager.setProgress(calculateProgress(e));
		};

		let mouseDownOriginIsSeekbar = false;

		this.seekbar.onmousedown = (e) => {
			// prevent selecting anything on screen
			e.preventDefault();
			mouseDownOriginIsSeekbar = true;

			AudioManager.pause();

			(document.onmousemove = setProgress)(e);
		};
		document.onmouseup = (e) => {
			if (!mouseDownOriginIsSeekbar) return;
			mouseDownOriginIsSeekbar = false;

			setProgress(e);
			AudioManager.play();

			// if the mouse is over the seekbar, keep the hover effect
			if (!this.isMouseOverSeekbar()) this.shrinkSeekbar();

			document.onmousemove = null;
		};

		this.seekbar.onwheel = (e) => {
			let delta;

			let currentVolume = AudioManager.getVolume();
			if (e.deltaY < 0) {
				delta = currentVolume < 5 ? 1 : 5;
			} else {
				delta = currentVolume <= 5 ? -1 : -5;
			}

			AudioManager.addVolume(delta, true);
			AudioManager.showVolumePopup();
		};

		// hover effect

		this.seekbar.onmouseenter = () => {
			this.isMouseOverSeekbarProp = true;
			this.enlargeSeekbar();
		};

		this.seekbar.onmouseleave = () => {
			this.isMouseOverSeekbarProp = false;

			// if the mouse is currently down on seekbar, do not the remove hover effect
			if (!mouseDownOriginIsSeekbar && !AudioManager.isPaused())
				this.shrinkSeekbar();
		};
	}

	static loadMarkers() {
		this.clearMarker();

		SongManager.getCurrentSong()
			.getMarker()
			.forEach((marker) => this.addMarker(marker));
	}

	static createMarker() {
		const marker =
			(AudioManager.getCurrentTime() / AudioManager.getDuration()) * 100;

		const song = SongManager.getCurrentSong();
		if (!song) return;

		song.addMarker(marker);
		this.addMarker(marker);
	}

	static addMarker(marker) {
		const markerNode = this.marker.cloneNode(true);
		markerNode.style.left = `${marker}%`;
		this.seekbar.appendChild(markerNode);
	}

	static clearMarker() {
		this.seekbar
			.querySelectorAll(".marker")
			.forEach((marker) => marker.remove());
	}

	static deleteMarker() {
		const song = SongManager.getCurrentSong();
		if (!song) return;

		song.deleteMarker();
		SeekbarManager.clearMarker();
	}

	static isMouseOverSeekbar() {
		return this.isMouseOverSeekbarProp;
	}

	static enlargeSeekbar() {
		this.currentTime.classList.add("current-time-active");
		this.knobCircle.classList.add("knob-circle-active");
		this.knob.classList.add("knob-hover");
		this.progress.classList.add("seekbar-hover");

		this.seekbar.appendChild(this.markerHoverStyle);
	}

	static shrinkSeekbar() {
		this.currentTime.classList.remove("current-time-active");
		this.knobCircle.classList.remove("knob-circle-active");
		this.knob.classList.remove("knob-hover");
		this.progress.classList.remove("seekbar-hover");

		this.seekbar.removeChild(this.markerHoverStyle);
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
		this.progress.style.width = progress * 100 + "%";

		const currentTime = AudioManager.getDuration() * progress;
		this.currentTimeText.innerText = this.formatMinutes(currentTime);
	}

	/**
	 * @param {number} duration The duration in seconds.
	 */
	static setDuration(duration) {
		this.durationText.innerText = this.formatMinutes(duration);
	}
}

class EventManager {
	static {
		document.onkeydown = (e) => {
			if (e.code == "ControlLeft") this.control = true;

			if (!SearchManager.isActive()) {
				e.preventDefault();

				switch (e.code) {
					case "ArrowLeft":
						AudioManager.scrub(-5);
						return;
					case "ArrowRight":
						AudioManager.scrub(5);
						return;
					case "ArrowUp":
						SongManager.playPrevious();
						return;
					case "ArrowDown":
						SongManager.playNext();
						return;
					case "Space":
						AudioManager.toggle();
						return;
				}
			}

			if (this.control) {
				switch (e.code) {
					case "KeyE":
						e.preventDefault();
						AnimationManager.toggleAnimations();
						return;
					case "KeyM":
						e.preventDefault();
						SeekbarManager.createMarker();
						return;
					case "KeyC":
						e.preventDefault();
						SeekbarManager.deleteMarker();
						return;
					case "KeyA":
						if (
							!SearchManager.isSearchSelected() ||
							!SearchManager.isActive()
						) {
							e.preventDefault();
							SongManager.toggleAutoplay();
							return;
						}
				}
			}

			if (SearchManager.isActive()) {
				switch (e.code) {
					case "ArrowUp":
						SearchManager.selectPrevious();
						return;
					case "ArrowDown":
						SearchManager.selectNext();
						return;
					case "Enter":
						SearchManager.playCurrentResultItem();
						return;
					case "Escape":
						SearchManager.toggle();
						return;
				}
			} else {
				if (e.keyCode >= 48 && e.keyCode <= 90) {
					SearchManager.toggle();
					SearchManager.searchInput.value = e.key;
					SearchManager.updateSearch();
				}
			}

			SearchManager.searchInput.focus();
		};

		document.onkeyup = (e) => {
			if (e.code == "ControlLeft") this.control = false;
		};

		document.oncontextmenu = (e) => e.preventDefault();
	}
}

class ApiManager {
	static async querySongs(query) {
		return await this.request(`/search?q=${encodeURIComponent(query)}`);
	}

	static async getSongs(offset) {
		const songs = [];

		(await this.request(`/songs?offset=${offset}`)).forEach((song) => {
			songs.push(Song.fromJSON(song));
		});

		return songs;
	}

	static async editSong(id, song) {
		return await this.request(`/songs/${id}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(song),
		});
	}

	static async request(endpoint, options) {
		return await fetch(`/api${endpoint}`, options).json();
	}
}

class SongManager {
	static {
		this.image = $("#image");
		this.songList = $("#song-list");
		this.songItem = $("#song-item-template").content.firstElementChild;

		this.songs = new Map();
		this.currentSongItem = null;
		this.currentSong = null;

		this.autoplay = localStorage.getItem("autoplay") || false;

		// handle song playback
		this.songList.onclick = (e) => {
			if (e.target.classList.contains("song-item")) {
				this.playSongItem(e.target);
			}
		};

		this.getSongs(0).then(this.addSongsToList);
	}

	static isAutoplayEnabled() {
		return this.autoplay;
	}

	static toggleAutoplay() {
		this.autoplay = !this.autoplay;

		localStorage.setItem("autoplay", this.autoplay);

		PopupManager.showPopup(
			"Autoplay " + (this.autoplay ? "enabled" : "disabled"),
			600
		);
	}

	static async getSongs(offset) {
		let existingSongs = this.songs[offset];
		if (existingSongs) return existingSongs;

		const songs = await ApiManager.getSongs(offset);
		this.songs[offset] = songs;

		return songs;
	}

	static async querySongs(query) {
		const queryFilter = (song) =>
			song.name.includes(query) || song.artist.includes(query);

		const existingSongs = this.filter(queryFilter);
		if (existingSongs.length > 0) return existingSongs;

		const results = [];

		for (const offset in await ApiManager.querySongs(query)) {
			const songs = await this.getSongs(offset);

			this.addSongsToList(songs);

			results.push(songs.filter(queryFilter));
		}

		return results;
	}

	static filter(filter) {
		const songs = [];
		for (const offset in this.songs)
			for (const song of this.songs[offset]) if (filter(song)) songs.push(song);

		return songs;
	}

	static playSong(id) {
		for (const offset in this.songs) {
			const song = this.songs[offset].find((song) => song.id == id);
			if (song) {
				SongManager.currentSong = song;
				break;
			}
		}

		this.image.src = this.currentSong.image;

		AudioManager.setSong(this.currentSong);
		AudioManager.play();

		SeekbarManager.loadMarkers();
	}

	static playSongItem(songItem) {
		if (!songItem) return;

		this.playSong(songItem.id);
		this.setActive(songItem);

		songItem.scrollIntoViewIfNeeded(true);
	}

	static getCurrentSong() {
		return this.currentSong;
	}

	static setActive(songItem) {
		if (this.currentSongItem)
			this.currentSongItem.classList.remove("song-item-active");

		this.currentSongItem = songItem;
		if (songItem) this.currentSongItem.classList.add("song-item-active");
	}

	static playNext() {
		let next;
		if (this.currentSongItem) {
			next = this.currentSongItem.nextElementSibling;

			// if there is no next song, play the first song
			if (!next) next = this.songList.firstElementChild;
		} else {
			next = this.songList.firstElementChild;
		}

		this.playSongItem(next);
	}

	static playPrevious() {
		let next;
		if (this.currentSongItem) {
			next = this.currentSongItem.previousElementSibling;
			if (!next) next = this.songList.lastElementChild;
		} else {
			next = this.songList.lastElementChild;
		}

		this.playSongItem(next);
	}

	static createSongItem(song) {
		const songItem = this.songItem.cloneNode(true);

		songItem.id = song.id;

		$(".song-name", songItem).innerText = song.name;
		$(".song-artist", songItem).innerText = song.artist;
		$(".song-image", songItem).src = song.image;

		song.addDuration($(".song-duration", songItem));

		return songItem;
	}

	static addSongsToList(songs) {
		songs.forEach((song) => {
			const songItem = SongManager.createSongItem(song);
			SongManager.songList.appendChild(songItem);
		});
	}
}

class SearchManager {
	static {
		this.searchInputIsSelected = false;
		this.visible = false;
		this.search = $("#search-main");
		this.searchContainer = $("#search-container", this.search);
		this.searchInput = $("#search-input", this.search);

		this.results = $("#search-results");
		this.resultItem = $("#search-result-template").content.firstElementChild;
		this.currentResultItem = null;

		this.searchInput.onfocus = () => (this.searchInputIsSelected = true);
		this.searchInput.onblur = () => (this.searchInputIsSelected = false);

		this.results.onclick = (e) => {
			if (e.target == this.results) return;

			this.playResult(e.target);
		};

		this.search.onclick = (e) => {
			if (e.target != this.search && e.target != this.searchContainer) return;
			SearchManager.toggle();
		};

		this.searchInput.addEventListener("input", this.updateSearch);
	}

	static updateSearch() {
		// prevent searching for empty string
		if (SearchManager.searchInput.value.length == 0) {
			clearTimeout(this.searchTimeout);
			SearchManager.clearResults();
			return;
		}

		clearTimeout(this.searchTimeout);
		this.searchTimeout = setTimeout(() => {
			SongManager.querySongs(SearchManager.searchInput.value).then((found) => {
				SearchManager.clearResults();

				found.forEach((song) => SearchManager.addResult(song));
			});
		}, 300);
	}
	static playCurrentResultItem() {
		this.playResult(this.currentResultItem);
	}

	static playResult(resultItem) {
		// unset song from song list, otherwise we need to search for it
		SongManager.setActive(null);
		SongManager.playSong(resultItem.id);
		SearchManager.toggle();
	}

	static setActive(resultItem) {
		if (resultItem) this.unselectSearchInput();
		else this.selectSearchInput();

		if (this.currentResultItem)
			this.currentResultItem.classList.remove("search-result-item-active");

		if (resultItem) resultItem.classList.add("search-result-item-active");

		this.currentResultItem = resultItem;
	}

	static selectSearchInput() {
		this.searchInput.focus();
	}

	static unselectSearchInput() {
		this.searchInput.blur();
	}
	static selectNext() {
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

	static addResult(song) {
		const resultItem = this.resultItem.cloneNode(true);

		resultItem.id = song.id;

		$(".search-result-song-name", resultItem).innerText = song.name;
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

			// wait for animation to finish
			setTimeout(() => {
				SearchManager.searchInput.value = "";
				this.clearResults();
			}, 100);
		} else {
			this.search.classList.add("search-active");
		}

		this.visible = !this.visible;
	}
}

class AnimationManager {
	static {
		this.animationsEnabled = localStorage.getItem("animationsEnabled") && true;
		this.image = $("#image");
		this.breathingAnimationInterval = null;

		this.animateImage = (x, y) => {
			image.style.transform = `
				perspective(5px) 
				translate(${x * 0.1}px, ${y * 0.1}px)
				rotateX(${0.00008 * -y}deg) 
				rotateY(${0.00008 * x}deg)
				rotate(${0.00005 * x * y}deg)
			`;
		};

		let time = 0;
		this.breathingAnimation = () => {
			if (AnimationManager.isMouseOnImage || AudioManager.isPaused()) return;

			time += 0.2;

			AnimationManager.animateImage(
				Math.sin(time) * 50,
				Math.cos(time / 2) * 50
			);
		};

		this.imageOnMouseMove = (e) => {
			if (e.timeStamp - this.lastMouseMoveCall < 100) return;
			this.lastMouseMoveCall = e.timeStamp;

			const position = image.getBoundingClientRect();
			const x = e.pageX - position.left - position.width / 2;
			const y = e.pageY - position.top - position.height / 2;

			AnimationManager.animateImage(x, y);
		};
		this.imageOnMouseOut = () => {
			image.style.transform = "translate(0px, 0px)";
		};

		image.onmouseenter = () => (AnimationManager.isMouseOnImage = true);
		image.onmouseleave = () => (AnimationManager.isMouseOnImage = false);

		if (this.animationsEnabled) this.start();
	}

	static stop() {
		AnimationManager.imageOnMouseOut();

		AnimationManager.image.onmousemove = null;
		AnimationManager.image.onmouseout = null;
		clearInterval(AnimationManager.breathingAnimationInterval);
	}

	static start() {
		AnimationManager.stop();

		AnimationManager.image.onmousemove = AnimationManager.imageOnMouseMove;
		AnimationManager.image.onmouseout = AnimationManager.imageOnMouseOut;
		AnimationManager.breathingAnimationInterval = setInterval(
			AnimationManager.breathingAnimation,
			1000 / 4
		);
	}

	static toggleAnimations() {
		if ((this.animationsEnabled = !this.animationsEnabled)) this.start();
		else this.stop();

		PopupManager.showPopup(
			"Animations " + (this.animationsEnabled ? "enabled" : "disabled"),
			600
		);

		if (this.animationsEnabled) {
			this.start();
		} else {
			this.stop();
		}

		localStorage.setItem("animationsEnabled", this.animationsEnabled);
	}
}
