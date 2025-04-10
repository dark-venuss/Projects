const dino = document.getElementById("dino");
const cactus = document.getElementById("cactus");
const scoreLabel = document.getElementById("score");

let score = 0;
let scoreUpdated = false; // Flag to track if the score has been updated
scoreLabel.textContent = "Score: 000";

// Function to handle jumping
function jump() {
  if (dino.classList != "jump") {
    dino.classList.add("jump");
    setTimeout(function () {
      dino.classList.remove("jump");
    }, 300);
  }
}

// Function to update the score
function updateScore() {
  score += 100;
  scoreLabel.textContent = `Score: ${score}`;
}

// Check for collisions and update the score
let isAlive = setInterval(function () {
  // Get current dino Y position
  let dinoTop = parseInt(window.getComputedStyle(dino).getPropertyValue("top"));
  // Get current cactus X position
  let cactusLeft = parseInt(
    window.getComputedStyle(cactus).getPropertyValue("left")
  );

  // Detect collision
  if (cactusLeft < 50 && cactusLeft > 0 && dinoTop >= 140) {
    // Collision detected
    alert("Game Over!");
    score = 0; // Reset score
    scoreLabel.textContent = "Score: 0"; // Reset score display
    clearInterval(isAlive); // Stop the game
  } else if (cactusLeft < 0 && !scoreUpdated) {
    // Update score when the cactus goes off-screen
    updateScore();
    scoreUpdated = true; // Mark the score as updated
  } else if (cactusLeft > 50) {
    // Reset the scoreUpdated flag when the cactus reappears
    scoreUpdated = false;
  }
}, 10);

// Add event listener for jumping
document.addEventListener("keydown", function (event) {
  if (event.code === "Space") { // Check if the pressed key is the spacebar
    jump();
  }
});
