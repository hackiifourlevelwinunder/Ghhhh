const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE = path.join(__dirname, "history.json");
const MAX_HISTORY = 1000;

app.use(express.static(path.join(__dirname, "public")));

// load history
let history = [];
try {
  if (fs.existsSync(STORAGE)) {
    const raw = fs.readFileSync(STORAGE, "utf8") || "[]";
    history = JSON.parse(raw);
  }
} catch (e) {
  console.error("Failed to read history:", e);
  history = [];
}

function saveHistory() {
  try {
    fs.writeFileSync(STORAGE, JSON.stringify(history.slice(-MAX_HISTORY), null, 2));
  } catch (e) {
    console.error("Failed to write history:", e);
  }
}

function floorToMinute(ms) {
  const d = new Date(ms);
  d.setSeconds(0,0);
  return d.getTime();
}

// SSE clients
let clients = [];

// send event to all clients
function broadcast(type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(payload));
}

// generate secure 0-9
function generateNumber() {
  return crypto.randomInt(0, 10);
}

let lastGeneratedMinute = null;

function createEntry(minuteStartMs) {
  if (lastGeneratedMinute === minuteStartMs) return null;
  const number = generateNumber();
  const entry = {
    minuteStartIso: new Date(minuteStartMs).toISOString(),
    minuteStartMs,
    number,
    revealedAtIso: new Date().toISOString()
  };
  history.push(entry);
  if (history.length > MAX_HISTORY) history.shift();
  saveHistory();
  lastGeneratedMinute = minuteStartMs;
  console.log("Generated:", entry);
  return entry;
}

// Scheduler: schedule reveal at (nextMinuteStart - 35s)
function scheduleNextReveal() {
  const now = Date.now();
  const currentMinuteStart = floorToMinute(now);
  const nextMinuteStart = currentMinuteStart + 60_000;
  const revealTime = nextMinuteStart - 35_000;
  const msUntilReveal = revealTime - now;

  if (msUntilReveal <= 0) {
    // missed, generate immediately for nextMinuteStart
    const entry = createEntry(nextMinuteStart);
    if (entry) broadcast("reveal", entry);
    // schedule next
    setTimeout(scheduleNextReveal, 1000);
  } else {
    console.log(`Scheduling reveal at ${new Date(revealTime).toISOString()} for minute ${new Date(nextMinuteStart).toISOString()}`);
    setTimeout(() => {
      const entry = createEntry(nextMinuteStart);
      if (entry) broadcast("reveal", entry);
      scheduleNextReveal();
    }, msUntilReveal);
  }
}

// Start scheduler on boot
scheduleNextReveal();

// SSE endpoint
app.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write("\n");

  // send initial state: history and server time info
  res.write(`event: init\ndata: ${JSON.stringify({ history, serverTime: new Date().toISOString() })}\n\n`);

  clients.push(res);
  req.on("close", () => {
    clients = clients.filter(r => r !== res);
  });
});

// API to fetch history (in case client needs)
app.get("/history", (req, res) => {
  res.json({ count: history.length, results: history.slice().reverse() });
});

// basic status
app.get("/status", (req, res) => {
  const now = Date.now();
  const nextMinuteStart = floorToMinute(now) + 60_000;
  const revealAt = new Date(nextMinuteStart - 35_000).toISOString();
  res.json({ now: new Date(now).toISOString(), nextMinuteStart: new Date(nextMinuteStart).toISOString(), revealAt });
});

// Serve index.html from public (static)
// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});