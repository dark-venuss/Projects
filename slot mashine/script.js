// Select the message and balance elements
const messageElement = document.getElementById("message");
const balanceElement = document.getElementById("balance");

// Function to update the message
function updateMessage(message) {
  messageElement.textContent = message;
  messageElement.style.backgroundColor = "#ffffff80";
  messageElement.style.marginBottom = "20px";
}

// Function to update the balance
function updateBalance(balance) {
  balanceElement.textContent = `Balance: $${balance}`;
}

// Get input elements
const depositAmountInput = document.getElementById("depositAmount");
const numberOfLinesInput = document.getElementById("numberOfLines");
const betPerLineInput = document.getElementById("betPerLine");

let balance = 0; // Initialize balance outside the game function

const deposit = () => {
  const depositAmount = parseFloat(depositAmountInput.value);
  if (isNaN(depositAmount) || depositAmount <= 0) {
    updateMessage("Invalid deposit amount. Please try again.");
    return 0;
  } else {
    return depositAmount;
  }
};

// Determine number of lines to bet on
const getNumberOfLines = () => {
  const numberOfLines = parseInt(numberOfLinesInput.value);
  if (isNaN(numberOfLines) || numberOfLines <= 0 || numberOfLines > 3) {
    updateMessage("Invalid number of lines. Please try again.");
    return 1;
  } else {
    return numberOfLines;
  }
};

// Collect a bet amount
const getBet = (balance, lines) => {
  const bet = parseFloat(betPerLineInput.value);
  if (isNaN(bet) || bet <= 0 || bet > balance / lines) {
    updateMessage("Invalid bet amount. Please try again.");
    return 0;
  } else {
    return bet;
  }
};

// Spin the slot machine
const ROWS = 3;
const COLS = 3;
const SYMBOLS_COUNT = {
  A: 2,
  B: 4,
  C: 6,
  D: 8,
};
const SYMBOLS_VALUES = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
};
const spin = () => {
  const symbols = [];
  for (const [symbol, count] of Object.entries(SYMBOLS_COUNT)) {
    for (let i = 0; i < count; i++) {
      symbols.push(symbol);
    }
  }
  const reels = [[], [], []];
  for (let i = 0; i < COLS; i++) {
    const reelSymbols = [...symbols];
    for (let j = 0; j < ROWS; j++) {
      const selectedSymbol =
        reelSymbols[Math.floor(Math.random() * reelSymbols.length)];
      reels[i].push(selectedSymbol);
      reelSymbols.splice(reelSymbols.indexOf(selectedSymbol), 1);
    }
  }
  return reels;
};

// Transpose reels to rows
const transpose = (reels) => {
  const rows = [];
  for (let i = 0; i < ROWS; i++) {
    rows.push([]);
    for (let j = 0; j < COLS; j++) {
      rows[i].push(reels[j][i]);
    }
  }
  return rows;
};

// Print rows to the message element
const printRows = (rows) => {
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < rows[i].length; j++) {
      const reelId = `reel${i + 1}-${j + 1}`;
      const reelElement = document.getElementById(reelId);
      reelElement.textContent = rows[i][j];
    }
  }
};

// Calculate winnings
const getWinnings = (rows, bet, lines) => {
  let winnings = 0;
  for (let row = 0; row < lines; row++) {
    const symbols = rows[row];
    let allSame = true;
    for (const symbol of symbols) {
      if (symbol != symbols[0]) {
        allSame = false;
        break;
      }
    }
    if (allSame) {
      winnings += SYMBOLS_VALUES[symbols[0]] * bet;
    }
  }

  // Check for diagonal matches (top-left to bottom-right)
  if (lines >= 3 && rows[0][0] === rows[1][1] && rows[0][0] === rows[2][2]) {
    winnings += SYMBOLS_VALUES[rows[0][0]] * bet;
  }

  // Check for diagonal matches (top-right to bottom-left)
  if (lines >= 3 && rows[0][2] === rows[1][1] && rows[0][2] === rows[2][0]) {
    winnings += SYMBOLS_VALUES[rows[0][2]] * bet;
  }

  // Check if the value below the first row is the same
  for (let col = 0; col < COLS; col++) {
    if (rows[0][col] === rows[1][col]) {
      winnings += SYMBOLS_VALUES[rows[0][col]] * bet;
    }
  }
  return winnings;
};

// Main game function - now runs one round
let play = document.getElementById("spin-button");
play.addEventListener("click", () => {
  if (balance === 0) {
    balance = deposit();
    updateBalance(balance);
  }

  updateMessage(`Your balance is: $${balance}`);
  const numberOfLines = getNumberOfLines();
  const bet = getBet(balance, numberOfLines);
  balance -= bet * numberOfLines;
  updateBalance(balance);

  const reels = spin();
  const rows = transpose(reels);
  printRows(rows);

  const winnings = getWinnings(rows, bet, numberOfLines);
  balance += winnings;
  updateBalance(balance);

  updateMessage(`You won: $${winnings}`);
  if (balance <= 0) {
    updateMessage("You have no money left. Game over. ):");
    return;
  }
});
