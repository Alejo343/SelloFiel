/**
 * Empuja a Google los cambios de un local justo después de responder.
 *
 * El problema que resuelve: el cliente acaba de sumar su sello delante del
 * mozo. La pantalla del tap ya le muestra el número correcto, porque lee la
 * base directamente, pero su tarjeta del wallet esperaba al cron, hasta un
 * minuto. Si abría el wallet en ese momento, veía el número viejo.
 *
 * `after` ejecuta el trabajo una vez enviada la respuesta, así que el tap
 * sigue respondiendo igual de rápido (RNF-01) y la tarjeta se actualiza en
 * cosa de un segundo.
 *
 * El cron NO sobra: sigue siendo la red de seguridad para lo que falle aquí
 * (Google caído, un despliegue a mitad, un error de red). Esto es el camino
 * rápido; aquel es el que garantiza que nada se quede atrás.
 */

import { after } from 'next/server';

import { procesarCola } from '@/servicios/wallet/cola';

export function sincronizarWalletPronto(localId: string): void {
  after(async () => {
    try {
      await procesarCola({ localId, limite: 20 });
    } catch (error) {
      // Nunca puede tumbar la respuesta que ya se envió. Si falla, el cron
      // lo reintenta dentro de un minuto.
      console.error('[wallet] fallo al sincronizar tras la respuesta:', error);
    }
  });
}
