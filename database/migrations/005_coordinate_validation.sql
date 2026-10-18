-- Application queries must construct user-supplied points through this function.
-- PostGIS can normalize some out-of-range geometry values when casting to geography,
-- so the bounds are enforced before the geography value is created.
CREATE OR REPLACE FUNCTION make_wgs84_geography(longitude double precision, latitude double precision)
RETURNS geography(Point, 4326)
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
BEGIN
  IF longitude < -180 OR longitude > 180 THEN
    RAISE EXCEPTION 'longitude must be between -180 and 180' USING ERRCODE = '22023';
  END IF;
  IF latitude < -90 OR latitude > 90 THEN
    RAISE EXCEPTION 'latitude must be between -90 and 90' USING ERRCODE = '22023';
  END IF;

  RETURN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography;
END;
$$;
