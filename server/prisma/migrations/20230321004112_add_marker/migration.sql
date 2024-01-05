-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Marker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "songId" INTEGER NOT NULL,
    "marker" REAL NOT NULL,
    CONSTRAINT "Marker_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Marker" ("id", "marker", "songId") SELECT "id", "marker", "songId" FROM "Marker";
DROP TABLE "Marker";
ALTER TABLE "new_Marker" RENAME TO "Marker";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
