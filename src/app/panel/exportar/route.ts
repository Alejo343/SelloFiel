/**
 * Descarga de la base de clientes en CSV: /panel/exportar (RF-33)
 *
 * Respalda la promesa comercial: "la base es tuya; si te vas, te la llevas".
 */

import { aCsv } from '@/dominio/csv';
import { exigirSesion } from '@/lib/cookies-panel';
import { clientesParaExportar, obtenerLocalDelPanel } from '@/servicios/panel';

const fecha = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) : '');

export async function GET() {
  // Exige sesión y filtra por SU local: nadie descarga la base de otro.
  const sesion = await exigirSesion();
  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) return new Response('No encontrado', { status: 404 });

  const filas = await clientesParaExportar(sesion.localId);

  const csv = aCsv(
    [
      'Nombre',
      'WhatsApp',
      'Correo',
      'Cumpleaños',
      'Sellos disponibles',
      'Visitas totales',
      'Última visita',
      'En el club desde',
      'Autorizó el tratamiento de datos',
      'Versión del texto aceptado',
      'Pidió no recibir mensajes',
    ],
    filas.map((f) => [
      f.nombre,
      f.telefono,
      f.email,
      f.fechaNacimiento,
      f.sellosDisponibles,
      f.visitasTotales,
      f.ultimaVisita,
      fecha(f.creadoEn),
      fecha(f.consentimientoEn),
      f.consentimientoVersion,
      f.bajaEn ? `Sí, ${fecha(f.bajaEn)}` : 'No',
    ]),
  );

  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-${local.slug}-${hoy}.csv"`,
      // Datos personales: que ningún intermediario lo guarde en caché.
      'Cache-Control': 'no-store, private',
    },
  });
}
