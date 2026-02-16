
import sys
import os
import json
import csv
import time
from add_parking import get_coordinates_from_url, calculate_distance

# UTF-8 for Console
sys.stdout.reconfigure(encoding='utf-8')

JSON_PATH = os.path.join(os.path.dirname(__file__), '..', 'parking_data.json')
CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'parking_template.csv')

def parse_int(val, default):
    if not val or val.strip() == '': return default
    try:
        return int(val.strip())
    except:
        return default

def parse_int_none(val):
    if not val or val.strip() == '': return None
    try:
        return int(val.strip())
    except:
        return None

def main():
    print("=== CSV一括インポートツール ===")
    
    if not os.path.exists(CSV_PATH):
        print(f"エラー: テンプレートファイルが見つかりません ({CSV_PATH})")
        return

    # Load existing data to determine ID
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    max_id = max([item['id'] for item in data]) if data else 0
    new_entries = []

    print("CSVファイルを読み込んでいます...")
    
    # Try reading with utf-8-sig (Excel CSV)
    try:
        f = open(CSV_PATH, 'r', encoding='utf-8-sig')
        reader = csv.DictReader(f)
    except:
        # Fallback to cp932 (Shift-JIS)
        f = open(CSV_PATH, 'r', encoding='cp932')
        reader = csv.DictReader(f)

    rows = list(reader)
    total = len(rows)
    print(f"{total}件のデータが見つかりました。処理を開始します。\n")

    for i, row in enumerate(rows):
        name = row.get('名前')
        url = row.get('URL')
        
        # Skip sample or empty rows
        if not name or name == 'サンプル駐車場' or not url:
            continue

        print(f"[{i+1}/{total}] {name} を処理中...")

        # 1. Coordinates
        coords, fetched_name = get_coordinates_from_url(url)
        if not coords:
            print("  -> 座標取得失敗。スキップします。")
            continue
        
        # 2. Parse CSV fields using defaults
        day_start = row.get('昼開始(08:00)') or "08:00"
        day_end = row.get('昼終了(22:00)') or "22:00"
        
        w_day_p = parse_int(row.get('昼料金'), 200)
        w_day_u = parse_int(row.get('昼単位'), 30)
        w_night_p = parse_int(row.get('夜料金'), 100)
        w_night_u = parse_int(row.get('夜単位'), 60)
        
        # Max 1
        max_price_val = row.get('最大料金')
        max_price = int(max_price_val) if max_price_val and max_price_val.strip() else None
        max_desc = row.get('最大条件(24時間)')

        # Max 2
        max2_price = parse_int_none(row.get('最大料金2'))
        max2_desc = row.get('最大条件2(12時間)')

        weekend_same = row.get('休日同額(1=はい)') == '1'

        # 3. Construct Entry
        max_id += 1
        
        # Weekend logic
        if weekend_same:
            h_day_p, h_day_u = w_day_p, w_day_u
            h_night_p, h_night_u = w_night_p, w_night_u
            h_max, h_max_desc = max_price, max_desc
            h_max2, h_max2_desc = max2_price, max2_desc
        else:
            h_day_p = parse_int(row.get('休日昼料金'), 300)
            h_day_u = w_day_u # Assume same unit
            h_night_p, h_night_u = w_night_p, w_night_u # Assume same night
            
            h_max_val = row.get('休日最大')
            h_max = parse_int_none(h_max_val) if h_max_val else max_price
            h_max_desc = max_desc # Assume same desc if not specified, usually same

            h_max2_val = row.get('休日最大2')
            h_max2 = parse_int_none(h_max2_val) if h_max2_val else max2_price
            h_max2_desc = max2_desc

        entry = {
            "id": max_id,
            "name": name,
            "coords": coords,
            "distance": calculate_distance(coords),
            "capacity": None,
            "price_structure": {
                "weekday": {
                    "day": { "start": day_start, "end": day_end, "price": w_day_p, "unit_minutes": w_day_u },
                    "night": { "start": day_end, "end": day_start, "price": w_night_p, "unit_minutes": w_night_u },
                    "max": max_price,
                    "max_desc": max_desc if max_price else None,
                    "max2": max2_price,
                    "max2_desc": max2_desc if max2_price else None
                },
                "weekend": {
                    "day": { "start": day_start, "end": day_end, "price": h_day_p, "unit_minutes": h_day_u },
                    "night": { "start": day_end, "end": day_start, "price": h_night_p, "unit_minutes": h_night_u },
                    "max": h_max,
                    "max_desc": h_max_desc if h_max else None,
                    "max2": h_max2,
                    "max2_desc": h_max2_desc if h_max2 else None
                }
            },
            "note": None
        }
        
        new_entries.append(entry)
        time.sleep(1) 

    f.close()

    if not new_entries:
        print("追加可能なデータがありませんでした。")
        return

    # Append and Save
    data.extend(new_entries)
    
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n完了: {len(new_entries)}件のデータを追加しました。")
    
    # Git
    do_git = input("\nGitHubへプッシュしますか? (y/n) [y]: ").strip().lower()
    if do_git != 'n':
        os.chdir(os.path.dirname(JSON_PATH))
        os.system('git add parking_data.json')
        os.system(f'git commit -m "Bulk add: {len(new_entries)} entries via CSV"')
        os.system('git push')

if __name__ == "__main__":
    main()
