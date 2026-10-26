UPDATE folders
SET name = 'system.' || lower(name),
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE folder_type = 'system'
  AND lower(name) IN ('inbox','draft','sent','spam','archive','trash');
