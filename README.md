# osum!player - A music player for the web

A music player built in vanilla web technologies out of the need of a good music player.

## 🔬 Demo

Visit [music.osumatrix.me](https://music.osumatrix.me/) for a demo!

## 🖼️ Previews

Get a glimpse into osum!player and it's features.

### ▶️ Player

Intuitive and minimalistic player with your keyboard in mind.

<img src=https://user-images.githubusercontent.com/13122796/224856281-1c4513c5-f405-4f35-a504-0bb389e7f733.png>

### 🔍 Search

Effortless instant global search.

<img src=https://user-images.githubusercontent.com/13122796/224856294-fa23d28e-86d1-46a0-b754-d25c951c1a15.png>

### 🚩 Marker

Add marker to your favourite spots or highlights.

<img src=https://user-images.githubusercontent.com/13122796/224856313-746abc8c-a93f-40fe-af3a-3827a39cb428.png>

### 📱 Mobile view

Access the player from any device.

<img src=https://user-images.githubusercontent.com/13122796/224856336-f4d13aa2-98ce-4f69-8466-2d227916165f.png>

## ⭐ Features

- Fast & responsive
- Intuitive user experience
- Minimal design
- Keyboard oriented
- Autoplay
- Searching
- Marker

## 🪛 Server setup

1. Clone the repository:

   ```bash
   git clone git@github.com/oSumAtrIX/osum-player
   cd osum-player/server
   ```

2. Install dependencies

   1. Install libjpeg development package if you are on Linux
   2. Run `npm i`

3. Migrate the database:

   ```bash
   npx prisma migrate deploy
   ```

4. Configure environment variables using `env.example`:

   ```env
   SERVER_PORT=3000
   SONGS_PATH=songs/
   SONGS_PER_OFFSET=32
   DATABASE_URL="file:./database.db?connection_limit=1"
   IMAGE_CACHE_PATH=cache/
   ```

5. Start the server

   ```bash
   npm start
   ```

## ⌨️ Keybinds

- `CTRL+A`: Toggle autoplay
- `CTRL+M`: Add a marker
- `CTRL+C`: Clear all marker
- `CTRL+E`: Toggle animations
- `CTRL+D`: Toggle between endpoints
- `CTRL+Plus` Increase volume
- `CTRL+Minus` Decrease volume
- `A-Za-z`: Start search
- `Escape`: Close search
- `Space`: Play, pause or start a song
- `ArrowLeft`: Scrub forwards (Hold `SHIFT` for fine and `CTRL` for rough scrubbing)
- `ArrowRight`: Scrub backwards (Hold `SHIFT` for fine and `CTRL` for rough scrubbing)
- `ArrowUp`: Play previous song or select previous search result
- `ArrowDown`: Play next song or select previous search result
- `Enter`: Play currently selected search result

> **Note**: You can use your mouse wheel on the seekbar or album cover to adjust the volume.

## 🚩 Marker

To add a marker, press `CTRL+M`. The marker will appear on the seekbar which can be useful to highlight or mark favourite parts.
To clear all markers, press `CTRL+C`. The markers will automatically show up when playing songs.

## 🐔 Easter egg

Play with the album cover.

## 📝 Todo

- [x] Backend server
- [x] Adjusting volume with keybinds
- [x] Sort by newest modification date
- [x] Marker
- [x] Various play modes
- [ ] Last.FM integration
- [ ] Keybinds menu
- [ ] Playlists
- [ ] Queues
- [ ] Sync live changes
- [ ] Rainbow seekbar
- [ ] Global hotkeys
- [ ] Add new audio files with drag & drop
