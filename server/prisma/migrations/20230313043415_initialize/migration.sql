-- CreateTable
CREATE TABLE "Song" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "artist" TEXT,
    "filename" TEXT NOT NULL,
    "image" BLOB
);

-- CreateTable
CREATE TABLE "Marker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "songId" INTEGER NOT NULL,
    "time" INTEGER NOT NULL,
    CONSTRAINT "Marker_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Song_filename_key" ON "Song"("filename");
