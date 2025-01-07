// confetti.js

// Konfeti efektini başlatan fonksiyon
function startConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { x: 0.5, y: 0.5 } // Ortadan başlatır
  });
}

// Buton için bir event listener ekleyici
function setupConfettiButton(buttonId) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.addEventListener('click', startConfetti);
  } else {
    console.error(`Button with id "${buttonId}" not found.`);
  }
}
