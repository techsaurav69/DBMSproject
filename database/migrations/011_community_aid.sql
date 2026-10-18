CREATE TABLE community_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 3 AND 100),
  focus_area text NOT NULL CHECK (focus_area IN ('food', 'medical', 'shelter', 'transport', 'rescue', 'community_support', 'other')),
  summary text NOT NULL CHECK (char_length(trim(summary)) BETWEEN 10 AND 1500),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX community_groups_name_lower_unique ON community_groups (lower(name));

CREATE TABLE community_group_members (
  group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member' CHECK (member_role IN ('founder', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE community_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  pledged_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  contribution_kind text NOT NULL CHECK (contribution_kind IN ('volunteer_time', 'supplies', 'transport', 'money_pledge', 'other')),
  quantity numeric(12, 2) NOT NULL CHECK (quantity > 0),
  unit_label text NOT NULL CHECK (char_length(trim(unit_label)) BETWEEN 1 AND 50),
  details text NOT NULL CHECK (char_length(trim(details)) BETWEEN 3 AND 600),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX community_group_members_user_idx ON community_group_members (user_id, joined_at DESC);
CREATE INDEX community_pledges_group_created_idx ON community_pledges (group_id, created_at DESC);
