import { describe, expect, it } from 'vitest';

import { crearTokenAdmin, DURACION_SESION_ADMIN_MS, leerTokenAdmin } from '../../src/lib/sesion-admin';
import { crearTokenPanel } from '../../src/lib/sesion-panel';

const SECRETO = 'secreto-de-prueba-suficientemente-largo-123456';
const AHORA = 1_800_000_000_000;

describe('sesión de administrador', () => {
  it('devuelve la sesión guardada', () => {
    const s = { adminId: 'a1', creadaEn: AHORA };
    expect(leerTokenAdmin(crearTokenAdmin(s, SECRETO), SECRETO, AHORA)).toEqual(s);
  });

  it('caduca', () => {
    const t = crearTokenAdmin({ adminId: 'a1', creadaEn: AHORA }, SECRETO);
    expect(leerTokenAdmin(t, SECRETO, AHORA + DURACION_SESION_ADMIN_MS + 1)).toBeNull();
  });

  it('un token de DUEÑO no sirve como token de administrador', () => {
    // La prueba que más importa: comparten secreto, pero el prefijo de la
    // firma impide que un dueño se convierta en administrador.
    const deDueno = crearTokenPanel(
      { usuarioId: 'a1', localId: 'l1', creadaEn: AHORA },
      SECRETO,
    );
    expect(leerTokenAdmin(deDueno, SECRETO, AHORA)).toBeNull();
  });
});
