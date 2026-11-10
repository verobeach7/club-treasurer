-- Treasurer admin code: lets a treasurer re-enter the club as treasurer from another
-- device. Only the SHA-256 hash is stored; NULL until issued (older clubs re-issue it).
ALTER TABLE clubs ADD COLUMN admin_code_hash TEXT;
CREATE UNIQUE INDEX clubs_admin_code_hash ON clubs(admin_code_hash);
