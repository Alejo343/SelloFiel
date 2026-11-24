'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { normalizarTelefono } from '@/dominio/telefono';
import { exigirSesion } from '@/lib/cookies-panel';
import { actualizarLocal, actualizarPrograma } from '@/servicios/panel';
import { encolar } from '@/servicios/wallet/cola';

const esquema = z.object({
  nombre: z.string().trim().min(2, 'El nombre del local es obligatorio').max(80),
  premio: z.string().trim().min(3, 'Describe el premio').max(200),
  sellosObjetivo: z.coerce
    .number()
    .int('Tiene que ser un número entero')
    .min(1, 'Al menos 1 sello')
    .max(50, 'Más de 50 sellos desmotiva al cliente'),
  beneficioBienvenida: z.string().trim().max(200).optional().or(z.literal('')),
  semanasInactividad: z.coerce.number().int().min(1).max(52),
  diasAntesCumple: z.coerce.number().int().min(0).max(60),
  whatsapp: z.string().trim().optional().or(z.literal('')),
  /**
   * Google descarga esta imagen desde sus servidores, así que tiene que ser
   * pública y por HTTPS. Y tiene que ser permanente: Google no permite borrar
   * las plantillas, así que si el local cambia la URL después, su tarjeta
   * queda con el logo roto para siempre.
   */
  logoUrl: z
    .string()
    .trim()
    .url('El logo tiene que ser un enlace completo, empezando por https://')
    .refine((u) => u.startsWith('https://'), 'El enlace del logo tiene que ser https://')
    .optional()
    .or(z.literal('')),
  colorPrimario: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'El color va en formato #RRGGBB')
    .optional()
    .or(z.literal('')),
});

/**
 * Guarda la configuración.
 *
 * Toma solo el FormData, sin `useActionState`: la página es un componente de
 * servidor y así el formulario funciona aunque el JavaScript no haya cargado.
 * Los errores vuelven por la URL. Se pierde el valor inválido que el dueño
 * escribió, lo cual es aceptable acá: el formulario viene relleno de la base y
 * los campos numéricos ya los valida el navegador.
 */
export async function accionGuardarPrograma(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();

  const validacion = esquema.safeParse(Object.fromEntries(datos));

  if (!validacion.success) {
    const primero = validacion.error.issues[0];
    redirect(`/panel/programa?error=${encodeURIComponent(primero?.message ?? 'Revisa los datos')}`);
  }

  const v = validacion.data;

  // El WhatsApp del local se normaliza igual que el de los clientes: va a
  // acabar en un enlace wa.me, que necesita formato internacional.
  let whatsapp: string | null = null;
  if (v.whatsapp) {
    const normalizado = normalizarTelefono(v.whatsapp);
    if (!normalizado.valido) {
      redirect('/panel/programa?error=Ese+n%C3%BAmero+de+WhatsApp+no+parece+v%C3%A1lido');
    }
    whatsapp = normalizado.telefono;
  }

  await actualizarPrograma(sesion.localId, {
    sellosObjetivo: v.sellosObjetivo,
    premio: v.premio,
    beneficioBienvenida: v.beneficioBienvenida || null,
    semanasInactividad: v.semanasInactividad,
    diasAntesCumple: v.diasAntesCumple,
  });

  await actualizarLocal(sesion.localId, {
    nombre: v.nombre,
    whatsapp,
    logoUrl: v.logoUrl || null,
    colorPrimario: v.colorPrimario || undefined,
  });

  /**
   * La plantilla de Google lleva el nombre, el logo y el color del local, así
   * que cualquier cambio acá tiene que reflejarse allá. `guardarClase` es
   * idempotente: actualiza la que ya exista.
   */
  await encolar({ localId: sesion.localId, tipo: 'crear_clase' });

  redirect('/panel/programa?guardado=1');
}
