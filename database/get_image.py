from dbconfig import get_connection

def insert_image(game_id, game_data):
    conn = get_connection()
    cursor = conn.cursor()

    # 대표 이미지
    thumbnail_url = game_data["header_image"]
    cursor.execute("""
        INSERT INTO GameImage (game_id, image_url, image_type, sort_order, created_at)
        VALUES (%s, %s, 'thumbnail', 1, NOW())
    """, (game_id, thumbnail_url))

    # 스크린샷 최대 3장
    screenshots = game_data.get("screenshots", [])
    for idx, ss in enumerate(screenshots[:3], start=1):
        cursor.execute("""
            INSERT INTO GameImage (game_id, image_url, image_type, sort_order, created_at)
            VALUES (%s, %s, 'detail', %s, NOW())
        """, (game_id, ss["path_full"], idx))

    conn.commit()
    cursor.close()
    conn.close()
    print(f"이미지 저장 완료 (game_id={game_id})")
