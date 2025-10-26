import axios from "axios";
import mysql from "mysql2/promise";

// ✅ Steam AppID (예시: Cyberpunk 2077)
const appid = 1091500;
const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;

// ✅ MariaDB 연결 설정
const pool = mysql.createPool({
  host: "127.0.0.1",          // DB 주소
  user: "market",       // DB 사용자명
  password: "market",     // DB 비밀번호
  database: "marketdb",       // DB 이름
  port: 3306                  // 실제 DB 포트 (HeidiSQL에서 확인)
});

async function insertGame() {
  try {
    // 1️⃣ Steam API 요청
    const response = await axios.get(url);
    const data = response.data[appid];

    if (!data.success) {
      console.log("❌ API 응답 실패");
      return;
    }

    const info = data.data;

    // 2️⃣ API에서 필요한 정보 추출
    const title = info.name;
    const image = info.header_image;
    const developer = info.developers?.[0] || "정보없음";
    const description = info.short_description || "설명 없음";

    // 3️⃣ 가격 추출 (₩59,800 → 59800)
    const priceRaw = info.price_overview?.final_formatted || "0";
    const price = parseInt(priceRaw.replace(/[^\d]/g, "")) || 0;

    // 4️⃣ 날짜 변환 ("Dec 9, 2020" → "2020-12-09")
    const rawDate = info.release_date?.date || null;
    let release = "2000-01-01"; // 기본값

    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed)) {
        release = parsed.toISOString().split("T")[0];
      }
    }

    // 5️⃣ DB 삽입
    const [result] = await pool.query(
      `INSERT INTO Game (game_title, game_image, release_date, developer, price, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, image, release, developer, price, description]
    );

    console.log("✅ DB 저장 완료!");
    console.log("삽입된 game_id:", result.insertId);

    // 6️⃣ 저장 결과 확인
    const [[saved]] = await pool.query("SELECT * FROM Game WHERE game_id = ?", [result.insertId]);
    console.log("📦 저장된 데이터:", saved);

  } catch (err) {
    console.error("❌ 에러 발생:", err.message);
  } finally {
    await pool.end();
  }
}

// 실행
insertGame();
