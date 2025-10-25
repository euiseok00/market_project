from dbconfig import get_connection

def insert_genre(game_id, game_data):
    genres = game_data.get("genres", [])
    if not genres:
        print(f"장르 없음 (game_id={game_id})")
        return

    conn = get_connection()
    cursor = conn.cursor()

    for g in genres:
        genre_id = int(g["id"])
        genre_name = g["description"]

        # Genre 테이블에 없으면 추가
        cursor.execute("SELECT genre_id FROM Genre WHERE genre_id = %s", (genre_id,))
        if cursor.fetchone() is None:
            cursor.execute("INSERT INTO Genre (genre_id, genre_name) VALUES (%s, %s)", (genre_id, genre_name))

        # GameGenre 매핑 추가
        cursor.execute("INSERT INTO GameGenre (game_id, genre_id) VALUES (%s, %s)", (game_id, genre_id))

    conn.commit()
    cursor.close()
    conn.close()
    print(f"장르 저장 완료 (game_id={game_id})")
