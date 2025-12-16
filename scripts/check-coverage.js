const fs = require("fs");
const path = require("path");
const coverage = JSON.parse(fs.readFileSync("coverage/coverage-summary.json", "utf8"));
const cwd = process.cwd();

const paths = {
  "Path A (Auth)": { pattern: /lib\/auth/, target: 25 },
  "Path B (Billing)": { pattern: /lib\/stripe/, target: 25 },
  "Path C (Tier)": { pattern: /lib\/tier/, target: 25 },
  "Path D (Database)": { pattern: /lib\/db/, target: 25 },
  "Path E (MT5)": { pattern: /lib\/api/, target: 10 },
  "Path F (Alerts)": { pattern: /(lib\/jobs|app\/api\/(alerts|notifications))/, target: 10 },
  "Path G (Indicators)": { pattern: /app\/api\/indicators/, target: 10 },
  "Path H (Watchlist)": { pattern: /app\/api\/watchlist/, target: 10 },
  "Path J (UI)": { pattern: /components\/ui\//, target: 2 },
  "Path K (Admin)": { pattern: /app\/api\/admin/, target: 2 },
};

const results = {};

for (const [pathName, config] of Object.entries(paths)) {
  let totalStatements = 0;
  let coveredStatements = 0;

  for (const [file, data] of Object.entries(coverage)) {
    if (file === "total") continue;

    // Handle both absolute and relative paths
    const relativePath = file.startsWith(cwd) ? file.slice(cwd.length + 1) : file;

    if (config.pattern.test(relativePath)) {
      totalStatements += data.statements.total;
      coveredStatements += data.statements.covered;
    }
  }

  const stmtPct = totalStatements > 0 ? (coveredStatements / totalStatements * 100).toFixed(2) : "N/A";
  const pass = stmtPct !== "N/A" && parseFloat(stmtPct) >= config.target;

  results[pathName] = { target: config.target, statements: stmtPct, pass };
}

console.log("\n=== COVERAGE BY PATH ===\n");
console.log("| Path                 | Target | Actual  | Status |");
console.log("|----------------------|--------|---------|--------|");

for (const [path, data] of Object.entries(results)) {
  const status = data.pass ? "PASS" : "FAIL";
  const emoji = data.pass ? "+" : "-";
  console.log("| " + path.padEnd(20) + " | " + (data.target + "%").padEnd(6) + " | " + (data.statements + "%").padEnd(7) + " | " + emoji + " " + status + " |");
}

const allPass = Object.values(results).every(r => r.pass);
console.log("\n" + (allPass ? "ALL PATHS PASS COVERAGE TARGETS!" : "Some paths need more coverage"));
