"use strict";

const { execFile } = require("node:child_process");
const path = require("node:path");
let runningJobs = 0;

function runExcel(mode, input) {
  if (runningJobs >= 2) {
    return Promise.reject(Object.assign(new Error("Excel lain sedang diproses. Tunggu sebentar lalu coba kembali."), { status: 503 }));
  }
  const body = Buffer.isBuffer(input) ? input : Buffer.from(JSON.stringify(input));
  if (body.length > 40 * 1024 * 1024) {
    return Promise.reject(Object.assign(new Error("Data unduhan terlalu besar. Persempit filter lalu coba kembali."), { status: 422 }));
  }
  runningJobs++;
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.env.TIMELINE_PYTHON_BIN || "python3",
      [path.join(__dirname, "timeline-excel.py"), mode],
      { encoding: "buffer", timeout: 30000, maxBuffer: 25 * 1024 * 1024 },
      (error, stdout, stderr) => {
        runningJobs--;
        if (error) {
          let message = "Pemrosesan Excel gagal. Silakan coba kembali.";
          let status = 500;
          if (mode === "import" && !error.killed) {
            try {
              const detail = JSON.parse(stderr.toString("utf8"));
              if (typeof detail.error === "string") {
                message = detail.error;
                status = 400;
              }
            } catch {}
          }
          return reject(Object.assign(new Error(message), { status }));
        }
        if (mode === "import") {
          try { return resolve(JSON.parse(stdout.toString("utf8"))); }
          catch { return reject(new Error("Hasil pembacaan Excel tidak valid.")); }
        }
        resolve(stdout);
      }
    );
    child.stdin.on("error", () => {});
    child.stdin.end(body);
  });
}

module.exports = { runExcel };
