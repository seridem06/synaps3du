// ===== MISTI: mascota flotante con voz =====
const contenedor = document.getElementById('mistiFlotante');
const globo = document.getElementById('mistiGlobo');
const boton = document.getElementById('mistiBtn');
const cerrar = document.getElementById('mistiCerrar');

const saludo = '¡Hola, explorador! Soy Misti, tu gatito guía. ¡Hoy vamos a aprender muchas cosas juntos!';

const frases = [
  '¡Muy bien! Sigue así, eres un campeón.',
  '¿Practicamos multiplicaciones hoy?',
  'Recuerda: estudia veinte minutos y descansa cinco.',
  '¡Ya llevas cinco días seguidos! ¡Qué genial!',
  'Leer un ratito cada día te hace más inteligente.',
  '¡Completa el reto de hoy y gana cincuenta puntos!'
];

let vozEspanol = null;
let yaSaludo = false;

// Busca una voz en español (prioriza Perú / Latinoamérica)
function cargarVoz() {
  const voces = speechSynthesis.getVoices();
  vozEspanol =
    voces.find(v => v.lang === 'es-PE') ||
    voces.find(v => v.lang === 'es-MX' || v.lang === 'es-US' || v.lang === 'es-419') ||
    voces.find(v => v.lang.startsWith('es')) ||
    null;
}

if ('speechSynthesis' in window) {
  cargarVoz();
  speechSynthesis.onvoiceschanged = cargarVoz;
}

function hablar(texto) {
  globo.innerHTML = texto;
  globo.classList.remove('oculto');

  if (!('speechSynthesis' in window)) return;

  speechSynthesis.cancel();
  const mensaje = new SpeechSynthesisUtterance(texto);
  mensaje.lang = vozEspanol ? vozEspanol.lang : 'es-PE';
  if (vozEspanol) mensaje.voice = vozEspanol;
  mensaje.pitch = 1.7;   // voz aguda de gatito
  mensaje.rate = 1.0;

  mensaje.onstart = () => contenedor.classList.add('hablando');
  mensaje.onend = () => contenedor.classList.remove('hablando');
  mensaje.onerror = () => contenedor.classList.remove('hablando');

  speechSynthesis.speak(mensaje);
}

// Al tocar a Misti: saluda la primera vez, luego dice frases al azar
boton.addEventListener('click', () => {
  if (!yaSaludo) {
    yaSaludo = true;
    hablar(saludo);
  } else {
    const frase = frases[Math.floor(Math.random() * frases.length)];
    hablar(frase);
  }
});

// Saludo automático con el primer toque o clic en cualquier parte de la página
// (los navegadores no permiten voz sin una interacción previa)
document.addEventListener('pointerdown', (e) => {
  if (!yaSaludo && !boton.contains(e.target) && !cerrar.contains(e.target)) {
    yaSaludo = true;
    hablar(saludo);
  }
}, { once: true });

// Ocultar a Misti
cerrar.addEventListener('click', () => {
  speechSynthesis.cancel();
  contenedor.classList.add('oculta');
});
