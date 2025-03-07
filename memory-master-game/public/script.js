let playerName = '';
let showingAllLeaderboard = false;
let currentRound = null;
let hintLevel = 0;

function showGame() {
  document.querySelector('.try-now').style.display = 'none';
  const gameContent = document.getElementById('game-content');
  gameContent.style.display = 'block';
  setTimeout(() => gameContent.classList.add('show'), 10);
}

function validatePlayerName(name) {
  const nameRegex = /^[a-zA-Z0-9]+$/;
  const errorElement = document.getElementById('name-error');
  if (!name) {
    errorElement.textContent = 'Name cannot be empty.';
    return false;
  }
  if (name.length < 3 || name.length > 15) {
    errorElement.textContent = 'Name must be between 3 and 15 characters.';
    return false;
  }
  if (!nameRegex.test(name)) {
    errorElement.textContent = 'Name can only contain letters and numbers.';
    return false;
  }
  errorElement.textContent = '';
  return true;
}

function startGame() {
  const nameInput = document.getElementById('name').value;
  if (!validatePlayerName(nameInput)) return;
  playerName = nameInput;
  document.getElementById('player-name').style.display = 'none';
  document.getElementById('game-inputs').style.display = 'block';
  fetchNewRound();
  updateLeaderboard();
  hintLevel = 0;
  document.getElementById('hint-text').style.display = 'none';
  document.getElementById('submit-button').style.display = 'inline-block';
  document.getElementById('hint-button').style.display = 'inline-block';
  document.getElementById('play-again').style.display = 'none';
}

function fetchNewRound() {
  fetch('/api/game')
    .then(response => response.json())
    .then(data => {
      currentRound = data;
      document.getElementById('address').textContent = `0x${data.virtualAddr.toString(16).padStart(8, '0')} (${data.virtualAddr})`;
      const decimalPageTable = {};
      for (const [vpn, pfn] of Object.entries(data.pageTable)) {
        decimalPageTable[vpn] = pfn;
      }
      document.getElementById('page-table').textContent = JSON.stringify(decimalPageTable);
      document.getElementById('score').textContent = '0';
      const inputs = ['vpn', 'offset', 'pfn', 'phys'];
      inputs.forEach(id => {
        const input = document.getElementById(id);
        input.value = '';
        input.classList.remove('green', 'red'); // Clear highlights on new round
      });
      document.getElementById('submit-button').style.display = 'inline-block';
      document.getElementById('hint-button').style.display = 'inline-block';
      document.getElementById('play-again').style.display = 'none';
      hintLevel = 0;
      document.getElementById('hint-text').style.display = 'none';
    });
}

function submitAnswers() {
  const answers = [
    document.getElementById('vpn').value,
    document.getElementById('offset').value,
    document.getElementById('pfn').value,
    document.getElementById('phys').value
  ];
  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, answers, solution: currentRound.solution })
  })
    .then(response => response.json())
    .then(data => {
      let currentScore = parseInt(document.getElementById('score').textContent) || 0;
      let adjustedScore = data.score;

      // Apply zero-point rule if hint was used and score is 0
      if (data.score === 0 && hintLevel === 2) {
        adjustedScore = 0;
        alert('Zero points awarded because a hint was used and no correct answers were given.');
      }

      document.getElementById('score').textContent = currentScore + adjustedScore;
      updateLeaderboard();
      
      // Show correct answers and apply highlights
      const inputs = ['vpn', 'offset', 'pfn', 'phys'];
      const [correctVPN, correctOffset, correctPFN, correctPhys] = currentRound.solution;
      inputs.forEach((id, index) => {
        const input = document.getElementById(id);
        const userAnswer = parseInt(answers[index], 10) || 0;
        const correctAnswer = [correctVPN, correctOffset, correctPFN, correctPhys][index];
        input.value = correctAnswer; // Show correct answer
        if (userAnswer === correctAnswer) {
          input.classList.add('green');
          input.classList.remove('red');
        } else {
          input.classList.add('red');
          input.classList.remove('green');
        }
      });

      // Hide Submit and Hint, show Play Again
      document.getElementById('submit-button').style.display = 'none';
      document.getElementById('hint-button').style.display = 'none';
      document.getElementById('play-again').style.display = 'inline-block';
    });
}

function playAgain() {
  fetchNewRound();
}

function showHint() {
  const hintText = document.getElementById('hint-text');
  const scoreElement = document.getElementById('score');
  let currentScore = parseInt(scoreElement.textContent) || 0;

  if (hintLevel === 0) {
    hintText.style.display = 'block';
    hintText.innerHTML = `
      <strong>Formulas:</strong><br>
      1. VPN:<br>VPN = VA / 128 =<br>
      2. Offset:<br>Offset = VA mod 128 =<br>
      3. Lookup VPN in the Page Table:<br>PTE = 0x8000000f → valid bit = VPN → PFN =<br>
      4. Calculate PA:<br>PA = (PFN x 128) + offset =
    `;
    hintLevel = 1;
  } else if (hintLevel === 1) {
    if (currentRound) {
      const { virtualAddr, solution } = currentRound;
      const [vpn, offset, pfn, physAddr] = solution;
      currentScore -= 10;
      scoreElement.textContent = Math.max(0, currentScore);
      hintText.style.display = 'block';
      hintText.innerHTML = `
        <strong>Solved Example (Penalty: -10 points):</strong><br>
        1. VPN:<br>VPN = ${virtualAddr} / 128 = ${Math.floor(virtualAddr / 128)}<br>
        2. Offset:<br>Offset = ${virtualAddr} mod 128 = ${offset}<br>
        3. Lookup VPN in the Page Table:<br>PTE = 0x8000000f → valid bit = ${vpn} → PFN = ${pfn}<br>
        4. Calculate PA:<br>PA = (${pfn} x 128) + ${offset} = ${physAddr}
      `;
      hintLevel = 2;
    }
  } else {
    hintText.style.display = 'none';
  }
}

function updateLeaderboard() {
  fetch('/api/leaderboard')
    .then(response => response.json())
    .then(data => {
      const table = document.getElementById('leaderboard');
      table.innerHTML = '<tr><th>Rank</th><th>Player Name</th><th>Score</th></tr>';
      const displayData = showingAllLeaderboard ? data : data.slice(0, 5);
      displayData.forEach((entry, index) => {
        const row = table.insertRow();
        row.insertCell(0).textContent = index + 1;
        row.insertCell(1).textContent = entry[0];
        row.insertCell(2).textContent = entry[1];
        if (index === 0) row.style.backgroundColor = 'gold'; // 1st place
        else if (index === 1) row.style.backgroundColor = 'silver'; // 2nd place
        else if (index === 2) row.style.backgroundColor = '#cd7f32'; // 3rd place (bronze)
      });
    });
}

function toggleLeaderboard() {
  showingAllLeaderboard = !showingAllLeaderboard;
  document.getElementById('expand-leaderboard').textContent = showingAllLeaderboard ? 'Collapse' : 'Expand';
  updateLeaderboard();
}

updateLeaderboard();