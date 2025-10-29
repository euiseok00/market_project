import express from "express";
import dotenv from "dotenv";
import path from "path";
import session from "express-session";
import { fileURLToPath } from "url";
import gamesRouter from "./routes/common/games_routes.js";
import { attachUser } from "./middleware/attachUser.js";
import requireAdmin from "./middleware/requireAdmin.js";
import authRouter from "./routes/common/auth.js";
import usersRouter from "./routes/user/users.js";
import reviewsRouter from './routes/common/reviews.js';
import { getAllGames } from './services/games_service.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3006;

// ------------------------------------------------------
// ① 경로 설정 (EJS가 views 폴더를 찾을 수 있도록)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ② EJS 설정
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ------------------------------------------------------
// ③ 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 폼 데이터 처리
app.use(express.static(path.join(__dirname, "..", "public"))); // 정적파일(css,img)

// ------------------------------------------------------
// 세션 설정 (body parsers/static 다음, 라우트 등록 이전)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_me",
    resave: false,
    saveUninitialized: false,
    // production: use a proper store (Redis, connect-mongo, etc.)
  })
);

app.use(attachUser);

// ------------------------------------------------------
// ④ 라우터 연결 >  /games 로 들어오는 요청은 gamesRouter가 처리한다.
app.use("/games", gamesRouter);
app.use("/auth", authRouter);
app.use('/users', usersRouter);
app.use('/reviews', reviewsRouter);
// mount admin review routes
import adminReviewsRouter from './routes/admin/admin_reviews.js';
import adminGamesRouter from './routes/admin/games.js';
app.use('/admin/reviews', adminReviewsRouter);
app.use('/admin/games', adminGamesRouter);
// EJS-rendered user/admin pages (replace static HTML links)
app.get('/users/game_list', async (req, res) => {
  // require login to view game list
  if (!req.user) return res.redirect('/auth/login');
  try {
    const games = await getAllGames(100);
    res.render('users/game_list', { games, user: req.user });
  } catch (err) {
    console.error('Failed to load game list', err);
    res.status(500).send('서버 에러');
  }
});

app.get('/admin/game_list', requireAdmin, async (req, res) => {
  try {
    const games = await getAllGames(200);
    res.render('admin/game_list', { games, user: req.user });
  } catch (err) {
    console.error('Failed to load admin game list', err);
    res.status(500).send('서버 에러');
  }
});
// 회원가입 페이지 렌더링 (EJS)
app.get('/users/sign_in', (req, res) => {
  res.render('common/sign_in');
});

// ------------------------------------------------------
// ⑤ 기본 라우트 > 여기서 라우팅 경로는 받는거임 
app.get("/", (req, res) => {
  // 기본 페이지를 로그인으로 리다이렉트
  res.redirect('/auth/login');
});

// ------------------------------------------------------
// ⑥ 서버 시작
app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});

