const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files

const LEADERBOARD_FILE = 'leaderboard.json';
let leaderboard = fs.existsSync(LEADERBOARD_FILE) ? JSON.parse(fs.readFileSync(LEADERBOARD_FILE)) : {};

function generateRound() {
  const offset = Math.floor(Math.random() * 0x80); // 7-bit offset (0 to 127)
  const vpn = Math.floor(Math.random() * 0x40); // Small VPN range (0 to 63)
  const virtualAddr = (vpn << 7) | offset; // 32-bit address, max 0x00001FFF (8191 decimal)
  const pageTable = {};
  for (let i = 0; i < 5; i++) {
    pageTable[Math.floor(Math.random() * 0x40)] = Math.floor(Math.random() * 0x80);
  }
  pageTable[vpn] = Math.floor(Math.random() * 0x80); // Ensure VPN is in table
  const pfn = pageTable[vpn];
  const physicalAddr = (pfn << 7) | offset;
  return {
    virtualAddr,
    pageSizeBits: 7, // 128 bytes = 2^7
    pageTable,
    solution: [vpn, offset, pfn, physicalAddr]
  };
}

app.get('/api/game', (req, res) => res.json(generateRound()));
app.post('/api/submit', (req, res) => {
  const { playerName, answers, solution } = req.body; // Receive solution from client
  let points = answers.reduce((sum, ans, i) => {
    const userAnswer = parseInt(ans, 10) || 0;
    const correctAnswer = solution[i];
    const isCorrect = userAnswer === correctAnswer;
    console.log(`Index ${i}: User ${userAnswer}, Correct ${correctAnswer}, Points ${isCorrect ? 10 : 0}`);
    return sum + (isCorrect ? 10 : 0);
  }, 0); // Decimal comparison
  const speedBonus = 0; // Simplified
  const totalPoints = points + speedBonus;
  console.log(`Player: ${playerName}, Points: ${totalPoints}, New Total: ${(leaderboard[playerName] || 0) + totalPoints}`);
  leaderboard[playerName] = (leaderboard[playerName] || 0) + totalPoints;
  fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard));
  res.json({ score: totalPoints, leaderboard });
});
app.get('/api/leaderboard', (req, res) => {
  const sortedLeaderboard = Object.entries(leaderboard)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  res.json(sortedLeaderboard);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));