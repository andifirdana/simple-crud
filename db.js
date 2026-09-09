const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

module.exports = pool;

pool.query(`
  SELECT
    current_database(),
    current_user,
    current_schema()
`)
.then(result => {
  console.log("KONEKSI DATABASE:", result.rows[0]);
})
.catch(error => {
  console.error("ERROR DATABASE:", error);
});