from get_gameInfo import insert_game
from get_image import insert_image
from get_genre import insert_genre

# 원하는 게임 AppID들
appids = [1245620, 1086940, 1091500]

for appid in appids:
    game_id, game_data = insert_game(appid)
    if game_id:
        insert_image(game_id, game_data)
        insert_genre(game_id, game_data)