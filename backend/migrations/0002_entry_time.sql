-- Payment time (HH:MM, KST as printed on the receipt) for duplicate detection.
-- Existing rows keep NULL (= time unknown).
ALTER TABLE entries ADD COLUMN time TEXT;
CREATE INDEX entries_club_date_amount ON entries(club_id, date, amount);
