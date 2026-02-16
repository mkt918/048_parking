
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
NAGOYA_STATION = (35.1706, 136.8817)

def get_coordinates_from_url(url):
    print("URLを解析中...")
    try:
        context = ssl._create_unverified_context()
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) width=device-width'}
        )
        with urllib.request.urlopen(req, context=context) as response:
            final_url = response.geturl()
            html = response.read().decode('utf-8', errors='ignore')
            
            match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', final_url)
            if not match:
                match = re.search(r'content=".*?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)', html)
            
            coords = None
            if match:
                coords = [float(match.group(1)), float(match.group(2))]
                print(f"座標を取得しました: {coords}")
            else:
                print("座標の自動取得に失敗しました。")
                
            name = "新規駐車場"
            title_match = re.search(r'<meta property="og:title" content="(.*?)">', html)
            if title_match:
                name = title_match.group(1).replace(' - Google マップ', '').replace(' - Google Maps', '')
                print(f"名称を取得しました: {name}")
            else:
                title_match2 = re.search(r'<title>(.*?) - Google', html)
                if title_match2:
                    name = title_match2.group(1)
            
            return coords, name
    except Exception as e:
        print(f"エラーが発生しました: {e}")
        return None, "新規駐車場"

def calculate_distance(coords):
    if not coords: return "不明"
    R = 6371000
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
    
    print("\n[共通設定] 時間帯の設定")
    day_start = input_default("昼間 開始時間 (例: 08:00)", "08:00")
    day_end = input_default("昼間 終了時間 = 夜間 開始時間 (例: 22:00)", "22:00")
    
    # Defaults
    def_w_day_p = 200
    def_w_day_u = 30
    def_w_night_p = 100
    def_w_night_u = 60
    
    print("\n[平日] 料金設定")
    w_day_p = int(input_default(f"昼間 料金(円)", def_w_day_p))
    w_day_u = int(input_default(f"昼間 単位(分)", def_w_day_u))
    w_night_p = int(input_default(f"夜間 料金(円)", def_w_night_p))
    w_night_u = int(input_default(f"夜間 単位(分)", def_w_night_u))

    max_price_in = input_default(f"最大料金(円) (なし=null)", "1200")
    max_price = int(max_price_in) if max_price_in.lower() != 'null' else None
    
    w_max_desc = ""
    w_max2 = None
    w_max2_desc = None

    if max_price:
        w_max_desc = input_default(f"最大料金の条件 (例: 24時間, 当日24時まで)", "24時間")
        # Ask for Max 2
        has_max2 = input_default("別の最大料金設定はありますか? (y/n)", "n").lower() == 'y'
        if has_max2:
            w_max2 = int(input_default("最大料金2(円)", 800))
            w_max2_desc = input_default("最大料金2の条件 (例: 5時間)", "5時間")

    print("\n[休日] 料金設定")
    same_as_weekday = input_default("休日は平日と同じですか? (y/n)", "y").lower() == 'y'
    
    if same_as_weekday:
        h_day_p, h_day_u = w_day_p, w_day_u
        h_night_p, h_night_u = w_night_p, w_night_u
        h_max, h_max_desc = max_price, w_max_desc
        h_max2, h_max2_desc = w_max2, w_max2_desc
    else:
        h_day_p = int(input_default(f"昼間 料金(円)", 300))
        h_day_u = int(input_default(f"昼間 単位(分)", 30))
        h_night_p = int(input_default(f"夜間 料金(円)", w_night_p))
        h_night_u = int(input_default(f"夜間 単位(分)", w_night_u))
        
        h_max_in = input_default(f"最大料金(円) (なし=null)", str(max_price if max_price else 1500))
        h_max = int(h_max_in) if h_max_in.lower() != 'null' else None
        h_max_desc = ""
        h_max2 = None
        h_max2_desc = None
        
        if h_max:
             h_max_desc = input_default(f"最大料金の条件", w_max_desc if w_max_desc else "24時間")
             has_max2 = input_default("別の最大料金設定はありますか? (y/n)", "n").lower() == 'y'
             if has_max2:
                h_max2 = int(input_default("最大料金2(円)", 800))
                h_max2_desc = input_default("最大料金2の条件 (例: 5時間)", "5時間")

    # Note
    print("\n[その他]")
    note = input_default("備考", "")
    capacity = input_default("収容台数", "")

    entry = {
        "id": 0,
        "name": input_default("駐車場名", name),
        "coords": coords if coords else [0, 0],
        "distance": calculate_distance(coords),
        "capacity": capacity if capacity else None,
        "price_structure": {
            "weekday": {
                "day": { "start": day_start, "end": day_end, "price": w_day_p, "unit_minutes": w_day_u },
                "night": { "start": day_end, "end": day_start, "price": w_night_p, "unit_minutes": w_night_u },
                "max": max_price,
                "max_desc": w_max_desc if max_price else None,
                "max2": w_max2,
                "max2_desc": w_max2_desc if w_max2 else None
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
        "note": note if note else None
    }
    return entry

def main():
    print("=== 名古屋パーキング マップデータ追加ツール v1.2 ===")
    url = input("Google MapsのURLを入力してください:\n> ").strip()
    
    if not url: return

    coords, name = get_coordinates_from_url(url)
    
    if not coords:
        print("座標取得失敗。手動入力:")
        try:
            coords = [float(input("緯度: ")), float(input("経度: "))]
        except: return

    new_entry = create_entry(coords, name)
    
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    max_id = max([item['id'] for item in data]) if data else 0
    new_entry['id'] = max_id + 1
    
    data.append(new_entry)
    
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n成功: {new_entry['name']} を追加しました。")
    
    do_git = input("\nGitHubへプッシュしますか? (y/n) [y]: ").strip().lower()
    if do_git != 'n':
        os.chdir(os.path.dirname(JSON_PATH))
        os.system('git add parking_data.json')
        os.system(f'git commit -m "Auto-add: {new_entry["name"]}"')
        os.system('git push')

if __name__ == "__main__":
    main()
