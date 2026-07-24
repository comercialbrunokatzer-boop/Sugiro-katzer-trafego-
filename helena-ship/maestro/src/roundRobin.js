/**
 * Round-robin de corretor. O indice fica no estado (Firebase) pra sobreviver entre execucoes.
 * Puro e testavel: recebe pool + indice anterior, devolve o proximo.
 */
export function proximoCorretor(pool, indiceAnterior = -1) {
  if (!Array.isArray(pool) || pool.length === 0) return { corretor: null, indice: -1 };
  const indice = (Number(indiceAnterior) + 1) % pool.length;
  return { corretor: pool[indice], indice };
}
