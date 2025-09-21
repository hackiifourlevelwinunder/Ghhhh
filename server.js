import express from "express";
import crypto from "crypto";

const app = express();
const port = process.env.PORT || 3000;

let history = [];
let currentNumber = null;
let lastGenerated = null;

// Function to generate a secure random number (0-9)
function generateNumber() {
  currentNumber = crypto.randomInt(0, 10);
  lastGenerated = new Date();
  history.push({ time: lastGenerated, number: currentNumber });
  if (history.length > 100) history.shift(); // keep last 100 results
}

// First run immediately
generateNumber();

// Generate new number every full minute (00 sec)
setInterval(() => {
  generateNumber();
}, 60 * 1000);

// API endpoint
app.get("/", (req, res) => {
  const now = new Date();
  let displayNumber = currentNumber;

  // Show number only after 35 seconds have passed since generation
  if ((now - lastGenerated) / 1000 < 35 && history.length > 1) {
    displayNumber = history[history.length - 2].number;
  }

  res.json({
    current: displayNumber,
    generatedAt: lastGenerated,
    history: history
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
