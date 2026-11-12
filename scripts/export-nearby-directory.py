"""Build a dated, real map-directory fallback from public Overture Places.

Requires pyarrow with S3 support. The query covers the public Bengaluru region,
not a user's GPS position. Live searches and distance filtering happen in the API.
"""
import json
import pathlib
import urllib.request
from collections import Counter
import pyarrow.dataset as ds
import pyarrow.fs as fs

root = pathlib.Path(__file__).resolve().parents[1]
catalog = json.load(urllib.request.urlopen('https://stac.overturemaps.org/catalog.json'))
release = catalog['latest']
print(f'Reading public Bengaluru directory from Overture {release}', flush=True)
s3 = fs.S3FileSystem(anonymous=True, region='us-west-2', connect_timeout=10, request_timeout=60)
dataset = ds.dataset(f'overturemaps-us-west-2/release/{release}/theme=places/type=place', filesystem=s3, format='parquet')
bounds = [77.3, 12.6, 78.0, 13.3]
region = ((ds.field(('bbox', 'xmin')) >= bounds[0]) & (ds.field(('bbox', 'xmax')) <= bounds[2]) &
          (ds.field(('bbox', 'ymin')) >= bounds[1]) & (ds.field(('bbox', 'ymax')) <= bounds[3]))
# Basic-category filtering reduces transfer to relevant healthcare/safety records.
categories = ['hospital', 'medical_center', 'medical_clinic', 'health_clinic', 'clinic', 'police_station', 'fire_station', 'ambulance_service', 'emergency_medical_center', 'rescue_service']
table = dataset.to_table(columns=['id', 'names', 'basic_category', 'taxonomy', 'bbox', 'operating_status', 'addresses', 'phones', 'sources'], filter=region & ds.field('basic_category').isin(categories))
print('Source taxonomy:', Counter((row['taxonomy'] or {}).get('primary') for row in table.to_pylist()).most_common(25), flush=True)
mapping = {'hospital': 'hospital', 'medical_center': 'clinic', 'medical_clinic': 'clinic', 'health_clinic': 'clinic', 'clinic': 'clinic', 'police_station': 'police', 'fire_station': 'fire_station', 'ambulance_service': 'ambulance_station', 'emergency_medical_center': 'hospital', 'rescue_service': 'rescue_station'}
items = []
licenses = set()
for row in table.to_pylist():
    if row['operating_status'] == 'permanently_closed':
        continue
    name = (row['names'] or {}).get('primary')
    if not name:
        continue
    bbox = row['bbox']
    address = (row['addresses'] or [{}])[0]
    items.append({'id': 'overture/' + row['id'], 'name': name, 'category': mapping[row['basic_category']],
                  'latitude': (bbox['ymin'] + bbox['ymax']) / 2, 'longitude': (bbox['xmin'] + bbox['xmax']) / 2,
                  'address': ', '.join(str(address[key]) for key in ['freeform', 'locality', 'postcode', 'region'] if address.get(key)),
                  'phone': (row['phones'] or [None])[0]})
    for source in row['sources'] or []:
        if source.get('license'):
            licenses.add(source['license'])
output = {'source': 'Overture Maps Places', 'release': release, 'bounds': bounds,
          'attributionUrl': 'https://docs.overturemaps.org/attribution/', 'licenses': sorted(licenses), 'items': items}
destination = root / 'apps/api/src/integrations/data/bengaluru-services.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'Exported {len(items)} services ({destination.stat().st_size} bytes)', flush=True)
print('Categories:', {kind: sum(item['category'] == kind for item in items) for kind in set(mapping.values())}, flush=True)
