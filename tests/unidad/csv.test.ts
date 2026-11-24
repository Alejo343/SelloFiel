import { describe, expect, it } from 'vitest';

import { aCsv, celdaSegura } from '../../src/dominio/csv';

describe('celdaSegura: inyección de CSV', () => {
  it('neutraliza un nombre que Excel ejecutaría como fórmula', () => {
    // El ataque: un "cliente" se registra con este nombre en el formulario
    // público, y se ejecuta en el Excel del dueño al exportar.
    expect(celdaSegura('=HYPERLINK("http://malo.co","clic")')).toBe(
      '"\'=HYPERLINK(""http://malo.co"",""clic"")"',
    );
  });

  it('neutraliza todos los arranques peligrosos', () => {
    for (const malo of ['=1+1', '+57300', '-2+3', '@SUM(A1)', '\tx', '\rx']) {
      expect(celdaSegura(malo).replace(/^"/, '').startsWith("'")).toBe(true);
    }
  });

  it('deja intactos los datos normales', () => {
    expect(celdaSegura('Marta Fiel')).toBe('Marta Fiel');
    expect(celdaSegura('573001234567')).toBe('573001234567');
    expect(celdaSegura(8)).toBe('8');
    expect(celdaSegura(null)).toBe('');
  });

  it('entrecomilla lo que rompería las columnas', () => {
    expect(celdaSegura('Pérez; Juan')).toBe('"Pérez; Juan"');
    expect(celdaSegura('dice "hola"')).toBe('"dice ""hola"""');
    expect(celdaSegura('línea\nnueva')).toBe('"línea\nnueva"');
  });
});

describe('aCsv', () => {
  it('usa punto y coma y BOM, para que Excel en español lo abra bien', () => {
    const csv = aCsv(['Nombre', 'Sellos'], [['Marta', 8]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿Nombre;Sellos\r\nMarta;8\r\n');
  });
});
