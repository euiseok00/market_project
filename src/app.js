import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import testRouter from "./routes/test_routes.js";
import gamesRouter from "./routes/games_routes.js";

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
// ④ 라우터 연결 >  /games 로 들어오는 요청은 gamesRouter가 처리한다.
app.use("/test-db", testRouter);
app.use("/games", gamesRouter);

// ------------------------------------------------------
// ⑤ 기본 라우트 > 여기서 라우팅 경로는 받는거임 
app.get("/", (req, res) => {
  res.send("🎮 Game Market Server Running!");
});

// ------------------------------------------------------
// ⑥ 서버 시작
app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});

