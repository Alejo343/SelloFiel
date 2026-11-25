import { describe, expect, it } from 'vitest';

import { calcularEstado } from '../../src/dominio/sellos';
import {
  construirClase,
  construirObjeto,
  construirParcheSellos,
  imagenesNecesarias,
  urlImagenDelEstado,
  validarDisenoTarjeta,
} from '../../src/dominio/wallet';

const PLANTILLA = 'https://sellofiel.app/tarjetas/market/v1/sellos-{sellos}.jpg';

describe('diseño a medida: una imagen por cantidad de sellos', () => {
  it('elige la imagen del número de sellos', () => {
    expect(urlImagenDelEstado(PLANTILLA, { sellos: 7, objetivo: 10 })).toBe(
      'https://sellofiel.app/tarjetas/market/v1/sellos-7.jpg',
    );
  });

  it('por encima del objetivo usa la del objetivo (premio listo), nunca una que no existe', () => {
    expect(urlImagenDelEstado(PLANTILLA, { sellos: 13, objetivo: 10 })).toMatch(/sellos-10\.jpg$/);
  });

  it('sin diseño no hay imagen, y una plantilla sin marcador es una imagen fija', () => {
    expect(urlImagenDelEstado(null, { sellos: 3, objetivo: 10 })).toBeNull();
    expect(urlImagenDelEstado('https://x.test/fija.jpg', { sellos: 3, objetivo: 10 })).toBe('https://x.test/fija.jpg');
  });

  it('lista todas las imágenes que hay que publicar: de 0 al objetivo', () => {
    const urls = imagenesNecesarias(PLANTILLA, 10);
    expect(urls).toHaveLength(11);
    expect(urls[0]).toMatch(/sellos-0\.jpg$/);
    expect(urls[10]).toMatch(/sellos-10\.jpg$/);
    expect(imagenesNecesarias('https://x.test/fija.jpg', 10)).toEqual(['https://x.test/fija.jpg']);
  });

  it('solo acepta direcciones https, porque Google las descarga', () => {
    expect(validarDisenoTarjeta({ plantillaImagenUrl: PLANTILLA }).ok).toBe(true);
    expect(validarDisenoTarjeta({ plantillaImagenUrl: 'http://x.test/a-{sellos}.jpg' }).ok).toBe(false);
    expect(validarDisenoTarjeta({ logoAnchoUrl: 'no es una url' }).ok).toBe(false);
    expect(validarDisenoTarjeta({}).ok).toBe(true);
  });
});

describe('el diseño llega a Google Wallet', () => {
  const estado = calcularEstado(7, 10);

  it('la tarjeta nueva y cada actualización llevan la imagen de su estado', () => {
    const objeto = construirObjeto({
      issuerId: '1',
      localId: 'l',
      clienteId: 'c',
      clienteNombre: 'Ana',
      estado,
      premio: 'Un corte',
      urlTarjeta: 'https://x.test/t',
      plantillaImagenUrl: PLANTILLA,
    }) as { heroImage?: { sourceUri: { uri: string } } };
    expect(objeto.heroImage?.sourceUri.uri).toMatch(/sellos-7\.jpg$/);

    const parche = construirParcheSellos(calcularEstado(8, 10), 'Un corte', 'https://x.test/t', PLANTILLA) as {
      heroImage?: { sourceUri: { uri: string } };
    };
    expect(parche.heroImage?.sourceUri.uri).toMatch(/sellos-8\.jpg$/);
  });

  it('sin diseño no se manda imagen (la tarjeta queda como siempre)', () => {
    expect('heroImage' in construirParcheSellos(estado, 'x', 'https://x.test/t')).toBe(false);
  });

  it('el logo ancho va en la plantilla del local', () => {
    const clase = construirClase({
      issuerId: '1',
      localId: 'l',
      localNombre: 'The Market Gourmet',
      premio: 'x',
      sellosObjetivo: 10,
      logoUrl: 'https://x.test/logo.png',
      logoAnchoUrl: 'https://x.test/ancho.png',
    }) as { wideProgramLogo?: { sourceUri: { uri: string } } };
    expect(clase.wideProgramLogo?.sourceUri.uri).toBe('https://x.test/ancho.png');
  });
});
