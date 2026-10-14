CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, name),
  UNIQUE (id, user_id)
);

CREATE TABLE taggings (
  user_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('exercise','workout','program')),
  entity_id TEXT NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id),
  FOREIGN KEY (tag_id, user_id) REFERENCES tags(id, user_id) ON DELETE CASCADE
);
CREATE INDEX taggings_entity ON taggings(user_id, entity_type, entity_id);
