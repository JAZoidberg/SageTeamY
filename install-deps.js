const { execSync } = require("child_process");
const os = process.platform;

try {
  if (os === "linux") {
    console.log("🟢 Installing Linux dependencies...");
    execSync("bash ./install-deps-linux.sh", { stdio: "inherit" });
  } else if (os === "darwin") {
    console.log("🍎 Installing macOS dependencies...");
    execSync("bash ./install-deps-mac.sh", { stdio: "inherit" });
  } else if (os === "win32") {
    console.log("🟣 Installing Windows dependencies...");
    execSync("powershell -ExecutionPolicy Bypass -File install-deps-windows.ps1", { stdio: "inherit" });
  } else {
    console.error("❌ Unsupported OS:", os);
    process.exit(1);
  }
} catch (error) {
  console.error("⚠️ Dependency installation failed:", error);
  process.exit(1);
}
