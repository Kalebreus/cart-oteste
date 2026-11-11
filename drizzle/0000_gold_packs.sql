CREATE TABLE cards (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, author TEXT NOT NULL, name TEXT NOT NULL, game TEXT NOT NULL, collection TEXT NOT NULL, number TEXT NOT NULL, rarity TEXT NOT NULL, value_cents INTEGER NOT NULL CHECK(value_cents >= 0), condition TEXT NOT NULL, image TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX cards_created_at ON cards(created_at);
CREATE INDEX cards_owner_id ON cards(owner_id);
CREATE TABLE videos (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, author TEXT NOT NULL, title TEXT NOT NULL, game TEXT NOT NULL, description TEXT NOT NULL, source TEXT NOT NULL, source_type TEXT NOT NULL, cover TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX videos_created_at ON videos(created_at);
CREATE INDEX videos_owner_id ON videos(owner_id);
CREATE TABLE video_likes (video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE, user_id TEXT NOT NULL, PRIMARY KEY(video_id,user_id));
