# Nearby-service outage directory

`bengaluru-services.json` is a real, filtered extract of the Overture Maps Places release recorded in the file. It contains named hospital, police and fire-station records within the broad Bengaluru region (77.3–78.0 E, 12.6–13.3 N). Entries marked permanently closed are excluded. No user's coordinates were supplied to Overture: public regional files were filtered locally.

This is an outage fallback, not a live capacity feed or a guarantee of complete coverage. The API tries live OpenStreetMap providers first and labels directory responses with their source and release date. It calculates exact distances from each request on the server and will not return an empty regional result for areas outside the extract or unsupported service categories. Directions are based on recorded point locations.

To refresh from the latest published release, run `python scripts/export-nearby-directory.py` with PyArrow installed, inspect the source date/category counts, run the nearby-service tests and rebuild/deploy. Nest's assets configuration packages the JSON with the API. The ordinary application has no Python dependency.

Source: https://docs.overturemaps.org/guides/places/

Attribution: Overture Maps Foundation. Contains data from Meta, Microsoft and other Overture Places contributors, and Foursquare Open Source Places. Copyright 2024 Foursquare Labs, Inc. All rights reserved. Data has been filtered to a regional healthcare/safety subset, transformed to the application's schema, and distances/deduplication are applied by the API. See https://docs.overturemaps.org/attribution/ for the source attribution details.

Source licenses: CDLA-Permissive-2.0 and Apache-2.0. Copies are included alongside the directory. The complete Foursquare source notice is preserved in [FOURSQUARE-NOTICE.html](FOURSQUARE-NOTICE.html), from https://opensource.foursquare.com/places-notice-txt/.
