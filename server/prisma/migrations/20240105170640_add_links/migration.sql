-- CreateTable
CREATE TABLE "Link" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "songId" INTEGER NOT NULL,
    CONSTRAINT "Link_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Link_token_key" ON "Link"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Link_songId_key" ON "Link"("songId");
