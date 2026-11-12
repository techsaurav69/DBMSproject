-- Existing communities also require coordinator review. Memberships and offers are preserved.
ALTER TABLE community_groups
  ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 180),
  ADD COLUMN rejection_reason text CHECK (char_length(rejection_reason) <= 500),
  ADD COLUMN reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN qr_caption text NOT NULL DEFAULT '' CHECK (char_length(qr_caption) <= 240),
  ADD COLUMN media_version integer NOT NULL DEFAULT 1,
  ADD COLUMN announcement text NOT NULL DEFAULT '' CHECK (char_length(announcement) <= 1000),
  ADD COLUMN announcement_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN announcement_at timestamptz;

CREATE INDEX community_groups_status_created_idx ON community_groups (status, created_at DESC);

CREATE TABLE community_group_images (
  group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('logo', 'qr')),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  image_data bytea NOT NULL CHECK (octet_length(image_data) BETWEEN 16 AND 524288),
  PRIMARY KEY (group_id, kind)
);

CREATE TABLE community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_messages_history_idx ON community_messages (group_id, created_at DESC, id DESC);
