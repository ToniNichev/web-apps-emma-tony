-- Emma's World (Unity building game) persisted block placements.
--
-- Unlike Hangout Room, this is a single shared world rather than
-- multiple invite-gated rooms -- there is no rooms/room_players table,
-- and live presence (who's currently online) stays in-memory in
-- server.js (mirroring the existing hangoutPresence Map) rather than
-- being persisted here. Only the blocks themselves need to survive a
-- server restart / be visible to a player who joins later.
--
-- No migration tool in this repo (no existing migrations/ convention
-- found) -- run this by hand against the production DB.

CREATE TABLE emmas_world_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shape_index TINYINT UNSIGNED NOT NULL,       -- 0=Cube, 1=Wedge, 2=Cylinder, 3=Ball
  pos_x FLOAT NOT NULL,
  pos_y FLOAT NOT NULL,
  pos_z FLOAT NOT NULL,
  rotation_y SMALLINT UNSIGNED NOT NULL DEFAULT 0,  -- always a multiple of 90
  color_r TINYINT UNSIGNED NOT NULL,
  color_g TINYINT UNSIGNED NOT NULL,
  color_b TINYINT UNSIGNED NOT NULL,
  placed_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (placed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
