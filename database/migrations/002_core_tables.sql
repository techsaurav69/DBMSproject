CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 120),
  password_hash text NOT NULL CHECK (char_length(password_hash) >= 20),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  code user_role_code PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code user_role_code NOT NULL REFERENCES roles(code) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE disasters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(trim(name)) BETWEEN 3 AND 180),
  emergency_type emergency_type NOT NULL,
  status disaster_status NOT NULL DEFAULT 'active',
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 4000),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text CHECK (label IS NULL OR char_length(trim(label)) BETWEEN 2 AND 180),
  address_text text,
  coordinates geography(Point, 4326) NOT NULL,
  source location_source NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ST_SRID(coordinates::geometry) = 4326),
  CHECK (ST_X(coordinates::geometry) BETWEEN -180 AND 180),
  CHECK (ST_Y(coordinates::geometry) BETWEEN -90 AND 90)
);

CREATE TABLE affected_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id uuid NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 180),
  boundary geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ST_IsValid(boundary)),
  CHECK (ST_Area(boundary) > 0)
);

CREATE TABLE emergency_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id uuid REFERENCES disasters(id) ON DELETE SET NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source incident_source NOT NULL,
  emergency_type emergency_type NOT NULL,
  severity severity_level NOT NULL,
  status incident_status NOT NULL DEFAULT 'reported',
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 4000),
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (resolved_at IS NULL OR resolved_at >= reported_at)
);

CREATE TABLE emergency_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES emergency_incidents(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  category request_category NOT NULL,
  urgency severity_level NOT NULL,
  status request_status NOT NULL DEFAULT 'open',
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 4000),
  quantity numeric(12, 2),
  quantity_unit text,
  people_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK (quantity IS NULL OR quantity > 0),
  CHECK ((quantity IS NULL AND quantity_unit IS NULL) OR (quantity IS NOT NULL AND char_length(trim(quantity_unit)) BETWEEN 1 AND 40)),
  CHECK (people_count IS NULL OR people_count > 0),
  CHECK (closed_at IS NULL OR closed_at >= created_at)
);

CREATE TABLE service_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(trim(name)) BETWEEN 3 AND 180),
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  verification_status provider_verification_status NOT NULL DEFAULT 'pending',
  operational_status provider_operational_status NOT NULL DEFAULT 'operational',
  is_demo_provider boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (is_demo_provider)
);

CREATE TABLE resource_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]{1,62}$'),
  display_name text NOT NULL UNIQUE CHECK (char_length(trim(display_name)) BETWEEN 2 AND 120),
  category resource_category NOT NULL,
  default_unit text NOT NULL CHECK (char_length(trim(default_unit)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES service_providers(id) ON DELETE RESTRICT,
  resource_type_id uuid REFERENCES resource_types(id) ON DELETE SET NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  registration_code text NOT NULL UNIQUE CHECK (char_length(trim(registration_code)) BETWEEN 3 AND 40),
  vehicle_type vehicle_type NOT NULL,
  operational_status vehicle_operational_status NOT NULL DEFAULT 'available',
  is_demo_vehicle boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (is_demo_vehicle)
);

CREATE TABLE responders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES service_providers(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 120),
  specialty text NOT NULL CHECK (char_length(trim(specialty)) BETWEEN 2 AND 120),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resource_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES service_providers(id) ON DELETE RESTRICT,
  resource_type_id uuid NOT NULL REFERENCES resource_types(id) ON DELETE RESTRICT,
  on_hand_quantity numeric(12, 2) NOT NULL DEFAULT 0,
  reserved_quantity numeric(12, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, resource_type_id),
  CHECK (on_hand_quantity >= 0),
  CHECK (reserved_quantity >= 0),
  CHECK (reserved_quantity <= on_hand_quantity)
);

CREATE TABLE shelters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES service_providers(id) ON DELETE SET NULL,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  name text NOT NULL UNIQUE CHECK (char_length(trim(name)) BETWEEN 3 AND 180),
  approved_capacity integer NOT NULL CHECK (approved_capacity >= 0),
  occupied_count integer NOT NULL DEFAULT 0 CHECK (occupied_count >= 0),
  reserved_count integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  is_operational boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (occupied_count + reserved_count <= approved_capacity)
);

CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES emergency_requests(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status assignment_status NOT NULL DEFAULT 'assigned',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR completed_at >= assigned_at)
);

CREATE TABLE assignment_responders (
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES responders(id) ON DELETE RESTRICT,
  PRIMARY KEY (assignment_id, responder_id)
);

CREATE TABLE resource_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES emergency_requests(id) ON DELETE RESTRICT,
  inventory_id uuid NOT NULL REFERENCES resource_inventory(id) ON DELETE RESTRICT,
  allocated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  quantity numeric(12, 2) NOT NULL CHECK (quantity > 0),
  status allocation_status NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shelter_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES emergency_requests(id) ON DELETE RESTRICT,
  shelter_id uuid NOT NULL REFERENCES shelters(id) ON DELETE RESTRICT,
  reserved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  people_count integer NOT NULL CHECK (people_count > 0),
  status allocation_status NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  coordinates geography(Point, 4326) NOT NULL,
  source location_source NOT NULL,
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ST_SRID(coordinates::geometry) = 4326),
  CHECK (ST_X(coordinates::geometry) BETWEEN -180 AND 180),
  CHECK (ST_Y(coordinates::geometry) BETWEEN -90 AND 90)
);

CREATE TABLE request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES emergency_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  previous_status request_status,
  new_status request_status,
  event_type text NOT NULL CHECK (char_length(trim(event_type)) BETWEEN 2 AND 80),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(trim(action)) BETWEEN 2 AND 120),
  entity_type text NOT NULL CHECK (char_length(trim(entity_type)) BETWEEN 2 AND 80),
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
