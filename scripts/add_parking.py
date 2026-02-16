
import sys
import os
import json
import re
import math
import urllib.request
import urllib.parse
import ssl

# Configure UTF-8 for Windows Console
sys.stdout.reconfigure(encoding='utf-8')

# Constants
JSON_PATH = os.path.join(os.path.dirname(__file__), '..', 'parking_data.json')
NAGOYA_STATION = (35.1706, 136.8817) # Lat, Lng

def get_coordinates_from_url(url):
    print("URLを解析中...")
    try:
        # Create unverified context to avoid SSL errors on some machines
        context = ssl._create_unverified_context()
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) width=device-width'}
        )
        
        with urllib.request.urlopen(req, context=context) as response:
            final_url = response.geturl()
            html = response.read().decode('utf-8', errors='ignore')
            
            # Extract Coordinates
            # Pattern 1: @lat,lng
            match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', final_url)
            if not match:
                # Pattern 2: meta tag
                match = re.search(r'content=".*?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)', html)
            
            coords = None
            if match:
                coords = [float(match.group(1)), float(match.group(2))]
                print(f"座標を取得しました: {coords}")
            else:
                print("座標の自動取得に失敗しました。")
                
            # Extract Name
            name = "新規駐車場"
            title_match = re.search(r'<meta property="og:title" content="(.*?)">', html)
            if title_match:
                name = title_match.group(1).replace(' - Google マップ', '').replace(' - Google Maps', '')
                print(f"名称を取得しました: {name}")
            else:
                # Fallback to title tag
                title_match2 = re.search(r'<title>(.*?) - Google', html)
                if title_match2:
                    name = title_match2.group(1)
            
            return coords, name

    except Exception as e:
        print(f"エラーが発生しました: {e}")
        return None, "新規駐車場"

def calculate_distance(coords):
    if not coords: return "不明"
    
    R = 6371000 # Earth radius in meters
    lat1, lon1 = math.radians(NAGOYA_STATION[0]), math.radians(NAGOYA_STATION[1])
    lat2, lon2 = math.radians(coords[0]), math.radians(coords[1])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    dist_m = int(R * c)
    return f"{dist_m}m"

def input_default(prompt, default_val):
    val = input(f"{prompt} [{default_val}]: ").strip()
    return val if val else default_val

def create_entry(coords, name):
    print("\n--- 料金情報の入力 ---")
    print("※分からない場合はEnterでスキップ（デフォルト値が使われます）")
    
    # Defaults
    def_w_day_p = 200
    def_w_day_u = 30
    def_w_night_p = 100
    def_w_night_u = 60
    def_max = 1200
    
    # Weekday Inputs
    w_day_p = int(input_default(f"平日 昼間料金(円)", def_w_day_p))
    w_day_u = int(input_default(f"平日 昼間単位(分)", def_w_day_u))
    max_price = input_default(f"平日 最大料金(円) (なし=null)", str(def_max))
    max_price = int(max_price) if max_price.lower() != 'null' else None

    # Weekend
    same_as_weekday = input_default("休日は平日と同じですか? (y/n)", "y").lower() == 'y'
    
    if same_as_weekday:
        h_day_p = w_day_p
        h_day_u = w_day_u
        h_max = max_price
    else:
        h_day_p = int(input_default(f"休日 昼間料金(円)", 300))
        h_day_u = int(input_default(f"休日 昼間単位(分)", 30))
        h_max = input_default(f"休日 最大料金(円) (なし=null)", str(def_max))
        h_max = int(h_max) if h_max.lower() != 'null' else None

    # Note
    note = input_default("備考 (例: 予約可)", "")
    capacity = input_default("収容台数 (例: 10台)", "")

    entry = {
        "id": 0, # Placeholder
        "name": input_default("駐車場名", name),
        "coords": coords if coords else [0, 0],
        "distance": calculate_distance(coords),
        "capacity": capacity if capacity else None,
        "price_structure": {
            "weekday": {
                "day": { "start": "08:00", "end": "22:00", "price": w_day_p, "unit_minutes": w_day_u },
                "night": { "start": "22:00", "end": "08:00", "price": def_w_night_p, "unit_minutes": def_w_night_u },
                "max": max_price
            },
            "weekend": {
                "day": { "start": "08:00", "end": "22:00", "price": h_day_p, "unit_minutes": h_day_u },
                "night": { "start": "22:00", "end": "08:00", "price": def_w_night_p, "unit_minutes": def_w_night_u },
                "max": h_max
            }
        },
        "note": note if note else None
    }
    
    return entry

def main():
    print("=== 名古屋パーキング マップデータ追加ツール ===")
    url = input("Google MapsのURLを入力してください:\n> ").strip()
    
    if not url:
        print("URLが入力されませんでした。")
        return

    coords, name = get_coordinates_from_url(url)
    
    if not coords:
        print("座標が取得できませんでした。手動入力を試みますか？")
        try:
            lat = float(input("緯度: "))
            lng = float(input("経度: "))
            coords = [lat, lng]
        except:
            print("無効な入力です。終了します。")
            return

    new_entry = create_entry(coords, name)
    
    # Load JSON
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Assign ID
    max_id = max([item['id'] for item in data]) if data else 0
    new_entry['id'] = max_id + 1
    
    # Append
    data.append(new_entry)
    
    # Save
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n成功: {new_entry['name']} (ID: {new_entry['id']}) を追加しました。")
    print(f"場所: {JSON_PATH}")
    
    # Git
    do_git = input("\nGitHubへプッシュしますか? (y/n) [y]: ").strip().lower()
    if do_git != 'n':
        os.chdir(os.path.dirname(JSON_PATH))
        os.system('git add parking_data.json')
        os.system(f'git commit -m "Auto-add: {new_entry["name"]}"')
        os.system('git push')
        print("完了しました。")

if __name__ == "__main__":
    main()
