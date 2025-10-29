import { getAllGames } from '../services/games_service.js';

(async ()=>{
  try{
    const rows = await getAllGames(10);
    console.log('got', rows.length, 'rows');
    rows.forEach(r => console.log(r.game_id, r.game_title, 'price=', r.price, 'genre=', r.genre));
    process.exit(0);
  }catch(err){
    console.error('ERROR', err);
    process.exit(1);
  }
})();
