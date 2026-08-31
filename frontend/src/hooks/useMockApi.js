/**
 * Simula latencia de rede para os modulos api/*.js enquanto o backend real
 * nao esta plugado. Trocar por um cliente HTTP de verdade e' so substituir
 * o corpo de cada funcao `api/*.js` - os hooks/paginas que os consomem nao mudam.
 */
export function mockDelay(value, ms = 350) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
