// Canvas Confetti Fonksiyonu
function confetti({ particleCount, spread, origin }) {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: particleCount }, () => ({
    x: canvas.width * origin.x,
    y: canvas.height * origin.y,
    dx: Math.random() * 10 - 5,
    dy: Math.random() * 10 - 5,
    radius: Math.random() * 3 + 2,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
  }));

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.1; // Yerçekimi etkisi
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });

    requestAnimationFrame(render);
  }

  render();

  setTimeout(() => document.body.removeChild(canvas), 3000); // 3 saniye sonra canvas'ı kaldır
}

// Konfeti efektini başlatan fonksiyon
function startConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { x: 0.5, y: 0.5 },
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
