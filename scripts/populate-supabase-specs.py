import os
import requests
import re
import json

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
}

def extract_specifications(prod):
    title = prod.get('title') or ''
    brand = prod.get('brand') or ''
    model = prod.get('model') or ''
    cat = prod.get('category') or ''
    desc = prod.get('description') or ''

    specs = prod.get('specifications') or {}
    if not isinstance(specs, dict):
        specs = {}

    if brand and not specs.get('Brand'):
        specs['Brand'] = brand
    if model and not specs.get('Model'):
        specs['Model'] = model
    if cat and not specs.get('Category'):
        specs['Category'] = cat.capitalize()

    # Storage
    if not specs.get('Storage Capacity'):
        m = re.search(r'(\d+\s*(?:GB|TB))\b', title, re.I)
        if m: specs['Storage Capacity'] = m.group(1).upper()

    # RAM
    if not specs.get('RAM'):
        m = re.search(r'(\d+\s*GB)\s*RAM\b', title, re.I)
        if m: specs['RAM'] = m.group(1).upper()

    # Screen size
    if not specs.get('Display'):
        m = re.search(r'(\d+(?:\.\d+)?\s*(?:inch|\"|\'\'|\s*in\b))', title, re.I)
        if m: specs['Display'] = m.group(1).strip()

    # Power / Wattage
    if not specs.get('Power'):
        m = re.search(r'(\d+\s*W)\b', title, re.I)
        if m: specs['Power'] = m.group(1).upper()

    # Capacity
    if not specs.get('Capacity'):
        m = re.search(r'(\d+(?:\.\d+)?\s*(?:Qt|Oz|L|Gallon|Wh))\b', title, re.I)
        if m: specs['Capacity'] = m.group(1)

    # Color
    if not specs.get('Color'):
        m = re.search(r'\b(Black|White|Grey|Gray|Red|Blue|Teal|Charcoal|Silver|Gold|Green|Purple|Pink)\b', title, re.I)
        if m: specs['Color'] = m.group(1).capitalize()

    # Connectivity
    if not specs.get('Connectivity'):
        if re.search(r'\b(Bluetooth|WiFi|5G|4G|Wireless)\b', title, re.I):
            conns = re.findall(r'\b(Bluetooth|WiFi|5G|4G|Wireless)\b', title, re.I)
            specs['Connectivity'] = ', '.join(set(c.capitalize() for c in conns))

    # Features
    if not specs.get('Highlights'):
        features = []
        if '1080P' in title.upper(): features.append('1080p Full HD')
        if '4K' in title.upper(): features.append('4K Ultra HD')
        if 'OLED' in title.upper(): features.append('OLED Display')
        if 'AMOLED' in title.upper(): features.append('AMOLED Display')
        if 'IPX7' in title.upper() or 'WATERPROOF' in title.upper(): features.append('Waterproof')
        if 'NOISE CANCEL' in title.upper() or 'ANC' in title.upper(): features.append('Active Noise Cancellation')
        if features:
            specs['Highlights'] = ', '.join(features)

    return specs

def run():
    url = f'{SUPABASE_URL}/rest/v1/canonical_products?select=id,title,brand,model,category,description,specifications&limit=1000'
    res = requests.get(url, headers=headers).json()
    print(f'Fetched {len(res)} canonical products from Supabase.')

    session = requests.Session()
    session.headers.update(headers)

    updated_count = 0
    for p in res:
        specs = extract_specifications(p)
        if specs:
            pid = p['id']
            patch_res = session.patch(
                f'{SUPABASE_URL}/rest/v1/canonical_products?id=eq.{pid}',
                json={'specifications': specs}
            )
            if patch_res.status_code in (200, 204):
                updated_count += 1

    print(f'Successfully updated specifications for {updated_count} products in Supabase!')

if __name__ == '__main__':
    run()
