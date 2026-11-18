import { describe, expect, it } from 'vitest';

import {
  claveDeOcasion,
  enlaceWhatsApp,
  marcadoresDesconocidos,
  motivoLegible,
  PLANTILLAS_POR_DEFECTO,
  renderizarPlantilla,
  type DatosPlantilla,
} from '../../src/dominio/mensajes';

const DATOS: DatosPlantilla = {
  nombre: 'Marta',
  local: 'La Esquina',
  sellos: 7,
  faltan: 3,
  premio: 'una cena para dos',
};

describe('renderizarPlantilla', () => {
  it('reemplaza todos los marcadores conocidos', () => {
    const texto = '{nombre}, en {local} tienes {sellos} sellos, te faltan {faltan} para {premio}.';

    expect(renderizarPlantilla(texto, DATOS)).toBe(
      'Marta, en La Esquina tienes 7 sellos, te faltan 3 para una cena para dos.',
    );
  });

  it('reemplaza el mismo marcador varias veces', () => {
    expect(renderizarPlantilla('{nombre}, {nombre}, {nombre}', DATOS)).toBe('Marta, Marta, Marta');
  });

  it('deja intacto un marcador mal escrito, en vez de borrarlo', () => {
    // Si el local escribe {nombe} por error, es mejor que lo vea en el
    // mensaje antes de enviarlo que mandar una frase con un hueco.
    expect(renderizarPlantilla('Hola {nombe}', DATOS)).toBe('Hola {nombe}');
  });

  it('no toca un texto sin marcadores', () => {
    expect(renderizarPlantilla('Te esperamos', DATOS)).toBe('Te esperamos');
  });

  it('pone el enlace de opinión cuando lo hay, y vacío cuando no', () => {
    expect(
      renderizarPlantilla('Cuéntanos: {enlace}', { ...DATOS, enlaceOpinion: 'https://x.test/o/1' }),
    ).toBe('Cuéntanos: https://x.test/o/1');

    expect(renderizarPlantilla('Cuéntanos: {enlace}', DATOS)).toBe('Cuéntanos: ');
  });
});

describe('marcadoresDesconocidos', () => {
  it('detecta los que no existen, para avisar al local', () => {
    expect(marcadoresDesconocidos('Hola {nombre}, {apellido} y {nombe}')).toEqual([
      'apellido',
      'nombe',
    ]);
  });

  it('no repite el mismo error dos veces', () => {
    expect(marcadoresDesconocidos('{nombe} y {nombe}')).toEqual(['nombe']);
  });

  it('da lista vacía cuando está todo bien', () => {
    expect(marcadoresDesconocidos('{nombre} en {local}: {sellos}/{faltan} por {premio}')).toEqual(
      [],
    );
  });
});

describe('las plantillas por defecto son usables', () => {
  it('ninguna usa un marcador inexistente', () => {
    for (const [tipo, texto] of Object.entries(PLANTILLAS_POR_DEFECTO)) {
      expect(marcadoresDesconocidos(texto), `la plantilla ${tipo}`).toEqual([]);
    }
  });

  it('todas quedan legibles una vez rellenadas', () => {
    for (const texto of Object.values(PLANTILLAS_POR_DEFECTO)) {
      const resultado = renderizarPlantilla(texto, { ...DATOS, enlaceOpinion: 'https://x.test/o' });
      expect(resultado).not.toContain('{');
      expect(resultado).not.toContain('undefined');
    }
  });

  it('son cortas: un mensaje largo se lee como publicidad y se ignora', () => {
    for (const [tipo, texto] of Object.entries(PLANTILLAS_POR_DEFECTO)) {
      expect(renderizarPlantilla(texto, DATOS).length, `la plantilla ${tipo}`).toBeLessThan(180);
    }
  });
});

describe('enlaceWhatsApp', () => {
  it('arma el enlace con el número y el texto codificado', () => {
    const enlace = enlaceWhatsApp('573001234567', 'Hola Marta, ¿cómo estás?');

    expect(enlace.startsWith('https://wa.me/573001234567?text=')).toBe(true);
    expect(enlace).toContain('Hola%20Marta');
  });

  it('codifica acentos, eñes y emoji sin romper la URL', () => {
    const enlace = enlaceWhatsApp('573001234567', '¡Feliz cumpleaños! 🎉 Año nuevo');

    expect(enlace).not.toContain(' ');
    expect(enlace).not.toContain('ñ');
    // Y se puede volver a leer intacto.
    const texto = decodeURIComponent(new URL(enlace).searchParams.get('text')!);
    expect(texto).toBe('¡Feliz cumpleaños! 🎉 Año nuevo');
  });

  it('codifica el & y el # , que partirían la URL', () => {
    const enlace = enlaceWhatsApp('573001234567', 'Pollo & papas #promo');
    const texto = decodeURIComponent(new URL(enlace).searchParams.get('text')!);
    expect(texto).toBe('Pollo & papas #promo');
  });

  it('quita cualquier signo del teléfono', () => {
    // Si el número llega con signos, WhatsApp abre un chat vacío sin explicar
    // por qué, y el local cree que la herramienta no funciona.
    expect(enlaceWhatsApp('+57 300 123-4567', 'hola')).toContain('wa.me/573001234567?');
  });

  it('funciona con números de otros países', () => {
    expect(enlaceWhatsApp('541123456789', 'hola')).toContain('wa.me/541123456789?');
    expect(enlaceWhatsApp('595981123456', 'hola')).toContain('wa.me/595981123456?');
  });
});

describe('claveDeOcasion', () => {
  it('da una sola bienvenida en la vida del cliente', () => {
    expect(claveDeOcasion('bienvenida', { hoy: '2026-11-18' })).toBe('bienvenida');
    expect(claveDeOcasion('bienvenida', { hoy: '2027-03-02' })).toBe('bienvenida');
  });

  it('da un cumpleaños por año, aunque la ventana dure varios días', () => {
    // Sin esto el cliente recibiría una felicitación cada día de la ventana.
    const dias = ['2026-11-14', '2026-11-15', '2026-11-18', '2026-11-20'];
    const claves = new Set(dias.map((hoy) => claveDeOcasion('cumpleanos', { hoy })));

    expect(claves.size).toBe(1);
    expect([...claves][0]).toBe('cumpleanos:2026');
    // Y al año siguiente sí es otra ocasión.
    expect(claveDeOcasion('cumpleanos', { hoy: '2027-11-18' })).toBe('cumpleanos:2027');
  });

  it('da un aviso por racha de ausencia, no uno por día', () => {
    const a = claveDeOcasion('inactividad', { hoy: '2026-11-18', ultimoSello: '2026-09-01' });
    const b = claveDeOcasion('inactividad', { hoy: '2026-11-25', ultimoSello: '2026-09-01' });
    expect(a).toBe(b);
  });

  it('vuelve a avisar si el cliente regresa y se pierde otra vez', () => {
    const primera = claveDeOcasion('inactividad', { hoy: '2026-11-18', ultimoSello: '2026-09-01' });
    const segunda = claveDeOcasion('inactividad', { hoy: '2027-02-01', ultimoSello: '2026-12-10' });
    expect(primera).not.toBe(segunda);
  });

  it('da una pregunta por visita', () => {
    const lunes = claveDeOcasion('post_visita', { hoy: '2026-11-18', diaDeLaVisita: '2026-11-18' });
    const martes = claveDeOcasion('post_visita', { hoy: '2026-11-19', diaDeLaVisita: '2026-11-19' });
    expect(lunes).not.toBe(martes);
  });
});

describe('motivoLegible', () => {
  it('explica en una frase por qué está en la bandeja', () => {
    expect(motivoLegible('cumpleanos')).toMatch(/cumpleaños/i);
    expect(motivoLegible('inactividad')).toMatch(/no viene/i);
    expect(motivoLegible('post_visita')).toMatch(/cómo estuvo/i);
  });
});
