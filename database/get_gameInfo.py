import requests, datetime
from dbconfig import get_connection

def insert_game(appid):
    url = f"https://store.steampowered.com/api/appdetails?appids={appid}&cc=kr&l=korean"
    response = requests.get(url)
    data = response.json()

    if not data[str(appid)]["success"]:
        print(f"AppID {appid} 실패")
        return None, None

    game_data = data[str(appid)]["data"]

    # ----- Game 정보 파싱 -----
    game_title = game_data["name"]
    release_date_raw = game_data["release_date"]["date"]
    try:
        release_date = datetime.datetime.strptime(release_date_raw, "%Y년 %m월 %d일").strftime("%Y-%m-%d")
    except:
        release_date = None
    developer = game_data["developers"][0] if game_data["developers"] else "Unknown"
    price = game_data.get("price_overview", {}).get("final", 0)
    description = game_data.get("short_description", "")

    conn = get_connection()
    cursor = conn.cursor()

    sql = """
    INSERT INTO Game (title, release_date, developer, price, description)
    VALUES (%s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (game_title, release_date, developer, price, description))
    game_id = cursor.lastrowid

    conn.commit()
    cursor.close()
    conn.close()

    print(f"{game_title} 저장 완료! (AppID={appid}, game_id={game_id})")
    return game_id, game_data
