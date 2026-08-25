const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const EXCEPTIONS_FILE = path.join(__dirname, "../audit-exceptions.json");

// Read exceptions
let exceptions = [];
if (fs.existsSync(EXCEPTIONS_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, "utf8"));
    exceptions = data.exceptions || [];
  } catch (err) {
    console.error("Error parsing audit-exceptions.json:", err.message);
    process.exit(1);
  }
}

// Run npm audit
let auditJson;
try {
  auditJson = execSync("npm audit --json", { maxBuffer: 10 * 1024 * 1024 }).toString();
} catch (err) {
  // npm audit exits with non-zero if vulnerabilities are found
  if (err.stdout) {
    auditJson = err.stdout.toString();
  } else {
    console.error("Failed to run npm audit:", err.message);
    process.exit(1);
  }
}

let report;
try {
  report = JSON.parse(auditJson);
} catch (err) {
  console.error("Failed to parse npm audit output as JSON:", err.message);
  process.exit(1);
}

// Extract all high/critical advisories
const advisories = new Map();

if (report.vulnerabilities) {
  for (const [pkgName, vuln] of Object.entries(report.vulnerabilities)) {
    if (vuln.via) {
      for (const item of vuln.via) {
        if (typeof item === "object" && item.source) {
          // If the advisory itself is high or critical
          if (item.severity === "high" || item.severity === "critical") {
            advisories.set(item.source, item);
          }
        }
      }
    }
  }
}

// Filter and check against exceptions
const unexcepted = [];
const excepted = [];

for (const advisory of advisories.values()) {
  const isExcepted = exceptions.some((exc) => {
    return (
      (exc.advisoryId && String(exc.advisoryId) === String(advisory.source)) ||
      (exc.url && exc.url === advisory.url) ||
      (exc.package && exc.package === advisory.name)
    );
  });

  if (isExcepted) {
    excepted.push(advisory);
  } else {
    unexcepted.push(advisory);
  }
}

console.log("=== Dependency Vulnerability Audit ===");
if (excepted.length > 0) {
  console.log(`\nAllowed Exceptions (${excepted.length}):`);
  excepted.forEach((adv) => {
    const exc = exceptions.find(
      (e) =>
        (e.advisoryId && String(e.advisoryId) === String(adv.source)) ||
        (e.url && e.url === adv.url) ||
        (e.package && e.package === adv.name)
    );
    console.log(`- [EXCEPTED] ${adv.name} (${adv.severity}): ${adv.title}`);
    console.log(`  URL: ${adv.url}`);
    console.log(`  Reason: ${exc ? exc.reason : "No reason provided"}`);
  });
}

if (unexcepted.length > 0) {
  console.error(`\nFound Unexcepted High/Critical Vulnerabilities (${unexcepted.length}):`);
  unexcepted.forEach((adv) => {
    console.error(`- [FAIL] ${adv.name} (${adv.severity}): ${adv.title}`);
    console.error(`  URL: ${adv.url}`);
    console.error(`  To except this vulnerability, add it to audit-exceptions.json`);
  });
  console.error("\nAudit failed.");
  process.exit(1);
}

console.log("\nNo unexcepted high or critical vulnerabilities found. Audit passed.");
process.exit(0);
