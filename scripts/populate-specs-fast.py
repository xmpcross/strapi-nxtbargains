import os
import requests
import re
from concurrent.futures import ThreadPoolExecutor

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
}

def extract_specifications(prod):
    title = prod.get('title') or ''
    brand = prod.get('brand') or ''
    model = prod.get('model') or ''
    cat = prod.get('category') or ''

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

    return specs

def update_product(prod):
    specs = extract_specifications(prod)
    if specs:
        pid = prod['id']
        requests.patch(
            f'{SUPABASE_URL}/rest/v1/canonical_products?id=eq.{pid}',
            headers=headers,
            json={'specifications': specs}
        )

def run():
    url = f'{SUPABASE_URL}/rest/v1/canonical_products?select=id,title,brand,model,category,specifications&limit=1000'
    res = requests.get(url, headers=headers).json()
    print(f'Populating specifications for {len(res)} canonical products in parallel...')

    with ThreadPoolExecutor(max_workers=20) as executor:
        list(executor.map(update_product, res))

    check_res = requests.get(f'{SUPABASE_URL}/rest/v1/canonical_products?select=id,title,specifications&limit=1000', headers=headers).json()
    has_specs = [r for r in check_res if r.get('specifications') and len(r['specifications']) > 0]
    print(f'Done! {len(has_specs)} / {len(check_res)} canonical products now have populated specifications!')

if __name__ == '__main__':
    run()
