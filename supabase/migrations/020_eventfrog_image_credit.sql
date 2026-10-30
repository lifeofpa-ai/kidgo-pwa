-- Eventfrog: store the image copyright/credit line delivered with each event
-- (shown next to the image on the event detail page).
ALTER TABLE events ADD COLUMN IF NOT EXISTS bild_nachweis text;
