# osum!player - A music player for the web

A music player built in vanilla web technologies out of the need of a good music player.

## 🔬 Demo

Visit [music.osumatrix.me](https://music.osumatrix.me/) for a demo!

## 🖼️ Previews

Get a glimpse of osum!player and it's features.

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
- Mark hot spots
- Intuitive UX
- Minimal design
- Keyboard oriented
- Autoplay, shuffle, repeat or play once
- Global search
- Play history

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

4. Configure environment variables following the example from `env.example`:

5. Start the server

   ```bash
   npm start
   ```

## ⌨️ Keybinds

| Shortcut     | Description                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `CTRL+P`     | Rotate between play modes (Autoplay, shuffle, repeat or play once)                              |
| `CTRL+M`     | Add marker to highlight hotspots in your songs                                                  |
| `CTRL+C`     | Clear all markers                                                                               |
| `CTRL+A`     | Toggle animations                                                                               |
| `CTRL+E`     | Rotate between endpoints                                                                        |
| `CTRL+S`     | Sort by modified date or added                                                                  |
| `CTRL+Plus`  | Increase volume                                                                                 |
| `CTRL+Minus` | Decrease volume                                                                                 |
| `CTRL+R`     | Quick reload songs to update the database                                                       |
| `CTRL+H`     | Rotate between random themes                                                                    |
| `A-Za-z`     | Start a search                                                                                  |
| `Escape`     | Exit search                                                                                     |
| `Space`      | Play, pause, or start a song                                                                    |
| `Enter`      | Start the currently selected song or search result                                              |
| `ArrowLeft`  | Scrub backward (Hold `SHIFT` for fine and `CTRL` for rough scrubbing) or play the previous song |
| `ArrowRight` | Scrub forward (Hold `SHIFT` for fine and `CTRL` for rough scrubbing)                            |
| `ArrowUp`    | Select the previous song or the previous search result                                          |
| `ArrowDown`  | Play the next song or select the next search result                                             |
| `Home`       | Skip to the beginning of the current song                                                       |
| `End`        | Skip to the end of the current song                                                             |
| `PageUp`     | Play the previous song                                                                          |
| `PageDown`   | Play the next song                                                                              |
| `0-9`        | Seek to the corresponding time of the song                                                      |

> **Note**: You can use your mouse wheel on the seekbar or album cover to adjust the volume.

## 🚀 Action launcher

You can use the action launcher to quickly perform actions such as playing a song, or changing and toggling settings.
The acton launcher can be opened anytime by typing `>` everywhere or in the quick search bar.

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
- [x] Rainbow seekbar (Rotate between themes)
- [x] Last.FM integration
- [ ] Keybinds menu
- [ ] Playlists
- [ ] Queues
- [ ] Sync live changes
- [ ] Global hotkeys
- [ ] Add new audio files with drag & drop
- [ ] Share links
