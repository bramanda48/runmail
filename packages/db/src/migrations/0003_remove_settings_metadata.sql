-- Drop metadata column from settings table (only the refresh token value is needed)
ALTER TABLE settings DROP COLUMN metadata;
