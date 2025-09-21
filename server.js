
const express = require("express");
const crypto = require("crypto");
const cors = require("cors");

const app = express();
app.use(cors());

let clients = [];
let history = [];
let current = null;

// Broadcast
function broadcast(event, data) {
  clients.forEach(res => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// RNG scheduling
function scheduleRNG() {
  function runCycle() {
    const number = crypto.randomInt(0, 10);
    const ts = new Date();
    current = { number, generatedAt: ts.toISOString() };
    history.unshift(current);
    if (history.length > 20) history.pop();

    // Preview at :25 (35s before :00)
    setTimeout(() => {
      broadcast("preview", { previewAt: new Date().toISOString(), number });
    }, 25 * 1000);

    // Reveal at :00
    setTimeout(() => {
      broadcast("reveal", current);
    }, 60 * 1000);
  }

  const now = new Date();
  const sec = now.getUTCSeconds();
  const msToNextMinute = (60 - sec) * 1000 - now.getUTCMilliseconds();
  setTimeout(() => {
    runCycle();
    setInterval(runCycle, 60 * 1000);
  }, msToNextMinute);
}

app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  res.flushHeaders();
  clients.push(res);

  res.write(`data: ${JSON.stringify({ type: "connected", time: new Date().toISOString() })}\n\n`);

  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });
});

app.get("/history", (req, res) => {
  res.json(history);
});

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
  scheduleRNG();
});
