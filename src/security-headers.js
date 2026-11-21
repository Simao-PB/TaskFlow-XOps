// Cabecalhos HTTP de seguranca aplicados a todas as respostas.
// Corrigem os avisos do OWASP ZAP Baseline (SCRUM-28):
// 10020 (anti-clickjacking), 10038 (CSP), 10063 (Permissions-Policy)
// e 90004 (isolamento entre origens).

// Politica de conteudo: so recursos da propria origem. Nao usa
// 'unsafe-inline', por isso o JavaScript e o CSS estao em ficheiros
// separados em public/.
const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'"
].join('; ');

const CABECALHOS_SEGURANCA = Object.freeze({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
});

// Respostas da API (tarefas, metricas, alertas) nao devem ficar em cache.
const CABECALHOS_API = Object.freeze({
    'Cache-Control': 'no-store'
});

module.exports = {
    CONTENT_SECURITY_POLICY,
    CABECALHOS_SEGURANCA,
    CABECALHOS_API
};
