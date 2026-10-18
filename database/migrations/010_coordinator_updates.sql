CREATE TABLE coordinator_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('workflow', 'request_queue', 'dispatch', 'supply_tracking')),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coordinator_updates_scope_created_at_idx ON coordinator_updates (scope, created_at DESC);
