CREATE TABLE notification_receipts (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_key text NOT NULL CHECK (char_length(notification_key) BETWEEN 3 AND 180),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_key)
);

CREATE INDEX notification_receipts_user_read_at_idx ON notification_receipts (user_id, read_at DESC);
