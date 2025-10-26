import express from "express";
import pool from "../db/pool.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS now");
    res.json({ status: "OK", db_time: rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "DB connection failed" });
  }
});

export default router;
