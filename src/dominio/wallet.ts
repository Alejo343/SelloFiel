/**
 * Construcción de los pases de Google Wallet.
 *
 * Son funciones puras que arman los objetos JSON que espera la API. Vive en
 * `dominio/` a propósito: así se puede verificar que la estructura es correcta
 * sin credenciales y sin red, que es justo lo que hace falta mientras la
 * cuenta de emisor está en trámite.
 *
 * Vocabulario de Google, para no perderse:
 *  - **loyaltyClass**: la plantilla del programa. Una por local.
 *  - **loyaltyObject**: la tarjeta de un cliente concreto. Una por cliente.
 *  - **Issuer ID**: el identificador de la cuenta emisora (nosotros).
 *
 * Los identificadores de clase y objeto se forman `issuerId.sufijo`, y el
 * sufijo lo elegimos nosotros. Google NO permite borrar clases ni objetos, así
 * que los sufijos tienen que ser estables y derivados de datos que no cambian:
 * se usan los UUID de la base.
 */

import type { EstadoClub } from './sellos';

/** Caracteres admitidos en un sufijo de identificador de Google Wallet. */
function sufijoSeguro(valor: string): string {
  // Google acepta alfanuméricos, guion bajo, guion y punto. Los UUID ya
  // cumplen, pero se normaliza por si el dato viniera de otra parte.
  return valor.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function idDeClase(issuerId: string, localId: string): string {
  return `${issuerId}.local_${sufijoSeguro(localId)}`;
}

export function idDeObjeto(issuerId: string, clienteId: string): string {
  return `${issuerId}.cliente_${sufijoSeguro(clienteId)}`;
}

/* ------------------------------------------------------------- la clase */

/** Tope de Google para `merchantLocations` en una plantilla. */
export const MAXIMO_UBICACIONES = 10;

export interface DatosClase {
  issuerId: string;
  localId: string;
  localNombre: string;
  premio: string;
  sellosObjetivo: number;
  /** Coordenadas del local, para el aviso por cercanía */
  /** Las sedes activas con coordenadas, para el aviso por cercanía */
  ubicaciones?: Array<{ lat: string | null; lng: string | null }>;
  /** Enlace para que el cliente pida o reserve */
  whatsapp?: string | null;
  /**
   * OBLIGATORIO. Google rechaza la clase sin logo con el mensaje
   * "LoyaltyClass cannot be created without a program logo", aunque su
   * documentación lo presenta como opcional. Comprobado contra la API real el
   * 2026-11-12. Tiene que ser una URL pública: Google la descarga.
   */
  logoUrl?: string | null;
  colorPrimario?: string | null;
  /**
   * Logo ancho (1280×400, PNG transparente). Si está, en el celular reemplaza
   * al logo redondo y al nombre del encabezado. Parte del diseño a medida.
   */
  logoAnchoUrl?: string | null;
}

/* ------------------------------------------------ diseño a medida */

/** El marcador que la plantilla de imagen cambia por el número de sellos. */
export const MARCADOR_SELLOS = '{sellos}';

/**
 * La imagen principal de la tarjeta para un estado concreto.
 *
 * El diseño de cada local se prepara como una imagen por cantidad de sellos
 * (de 0 al objetivo), publicadas con un patrón de nombre:
 * `https://sellofiel.app/tarjetas/el-local/v1/sellos-{sellos}.jpg`. Por encima
 * del objetivo se usa la del objetivo: el cliente que junta sellos de más sin
 * canjear sigue viendo "premio listo".
 *
 * Una plantilla sin marcador es una imagen fija, la misma para todos.
 */
export function urlImagenDelEstado(
  plantilla: string | null | undefined,
  estado: Pick<EstadoClub, 'sellos' | 'objetivo'>,
): string | null {
  if (!plantilla) return null;
  const n = Math.max(0, Math.min(estado.sellos, estado.objetivo));
  return plantilla.split(MARCADOR_SELLOS).join(String(n));
}

/** Todas las imágenes que tiene que haber publicadas para un objetivo dado. */
export function imagenesNecesarias(plantilla: string, objetivo: number): string[] {
  if (!plantilla.includes(MARCADOR_SELLOS)) return [plantilla];
  return Array.from({ length: objetivo + 1 }, (_, n) => urlImagenDelEstado(plantilla, { sellos: n, objetivo })!);
}

/**
 * Google descarga las imágenes él mismo: tienen que ser HTTPS públicas. Se
 * valida antes de guardar, porque un error acá rompe la tarjeta de todos los
 * clientes del local a la vez.
 */
export function validarDisenoTarjeta(datos: {
  logoAnchoUrl?: string | null;
  plantillaImagenUrl?: string | null;
}): { ok: true } | { ok: false; motivo: string } {
  for (const [campo, valor] of [
    ['El logo ancho', datos.logoAnchoUrl],
    ['La imagen de la tarjeta', datos.plantillaImagenUrl],
  ] as const) {
    if (!valor) continue;
    let url: URL;
    try {
      url = new URL(valor.split(MARCADOR_SELLOS).join('0'));
    } catch {
      return { ok: false, motivo: `${campo}: la dirección no es válida` };
    }
    if (url.protocol !== 'https:') return { ok: false, motivo: `${campo}: tiene que empezar por https://` };
  }
  return { ok: true };
}

export function construirClase(datos: DatosClase) {
  if (!datos.logoUrl) {
    throw new Error(
      `El local "${datos.localNombre}" no tiene logo, y Google Wallet lo exige para crear la ` +
        'plantilla. Configura el logo del local, o define WALLET_LOGO_POR_DEFECTO con una URL ' +
        'pública.',
    );
  }

  const clase: Record<string, unknown> = {
    id: idDeClase(datos.issuerId, datos.localId),
    issuerName: datos.localNombre,
    programName: `Club de ${datos.localNombre}`,
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: datos.colorPrimario ?? '#111111',
    ...(datos.logoAnchoUrl
      ? {
          wideProgramLogo: {
            sourceUri: { uri: datos.logoAnchoUrl },
            contentDescription: {
              defaultValue: { language: 'es', value: datos.localNombre },
            },
          },
        }
      : {}),

    // Lo que el cliente ve como "premio" en la tarjeta.
    rewardsTierLabel: 'Premio',
    rewardsTier: datos.premio,

    textModulesData: [
      {
        id: 'como_funciona',
        header: 'Cómo funciona',
        body: `Suma un sello por visita. Al llegar a ${datos.sellosObjetivo} sellos: ${datos.premio}.`,
      },
    ],
  };

  clase.programLogo = {
    sourceUri: { uri: datos.logoUrl },
    contentDescription: {
      defaultValue: { language: 'es', value: `Logo de ${datos.localNombre}` },
    },
  };

  /**
   * El aviso por cercanía.
   *
   * Va en `merchantLocations` y NO en `locations`: ese campo está deprecado y
   * ya no dispara notificaciones. Google decide el radio, el tiempo de
   * permanencia y el texto del aviso; nosotros solo damos el punto. Y en
   * Android solo le llega a quien le dio al wallet permiso de ubicación
   * siempre, así que no se le puede prometer al local que llega a todos.
   */
  const puntos = (datos.ubicaciones ?? [])
    .filter((u) => u.lat && u.lng)
    .map((u) => ({ latitude: Number(u.lat), longitude: Number(u.lng) }))
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    // Google acepta hasta 10 puntos por plantilla.
    .slice(0, MAXIMO_UBICACIONES);
  if (puntos.length > 0) clase.merchantLocations = puntos;

  if (datos.whatsapp) {
    clase.linksModuleData = {
      uris: [
        {
          uri: `https://wa.me/${datos.whatsapp}`,
          description: 'Pedir o reservar por WhatsApp',
          id: 'whatsapp',
        },
      ],
    };
  }

  return clase;
}

/* ------------------------------------------------------------ el objeto */

export interface DatosObjeto {
  issuerId: string;
  localId: string;
  clienteId: string;
  clienteNombre: string;
  estado: EstadoClub;
  premio: string;
  /** URL de la tarjeta web, para el código de barras y el enlace */
  urlTarjeta: string;
  /** Plantilla de la imagen principal del local, si tiene diseño a medida */
  plantillaImagenUrl?: string | null;
}

function imagenPrincipal(plantilla: string | null | undefined, estado: EstadoClub) {
  const uri = urlImagenDelEstado(plantilla, estado);
  if (!uri) return {};
  return {
    heroImage: {
      sourceUri: { uri },
      contentDescription: {
        defaultValue: { language: 'es', value: `${estado.sellos} de ${estado.objetivo} sellos` },
      },
    },
  };
}

export function construirObjeto(datos: DatosObjeto) {
  return {
    id: idDeObjeto(datos.issuerId, datos.clienteId),
    classId: idDeClase(datos.issuerId, datos.localId),
    state: 'ACTIVE',

    ...imagenPrincipal(datos.plantillaImagenUrl, datos.estado),

    accountName: datos.clienteNombre,
    // El identificador que el local ve si tiene que buscar al cliente.
    accountId: datos.clienteId,

    loyaltyPoints: {
      label: 'Sellos',
      balance: { int: datos.estado.sellos },
    },

    /**
     * El código QR lleva a la tarjeta web del cliente. Así el personal del
     * local puede escanearlo para ver su estado, y el cliente tiene su
     * tarjeta a mano aunque borre el navegador.
     */
    barcode: {
      type: 'QR_CODE',
      value: datos.urlTarjeta,
      alternateText: `${datos.estado.sellos}/${datos.estado.objetivo} sellos`,
    },

    textModulesData: [
      {
        id: 'estado',
        header: datos.estado.premioDisponible ? '¡Premio disponible!' : 'Te faltan',
        body: datos.estado.premioDisponible
          ? `Pide tu premio en el local: ${datos.premio}`
          : `${datos.estado.faltan} ${datos.estado.faltan === 1 ? 'sello' : 'sellos'} para: ${datos.premio}`,
      },
    ],
  };
}

/* --------------------------------------------- el enlace para agregar */

/**
 * El cuerpo del JWT que firma el botón "Añadir a Google Wallet".
 *
 * `aud` y `typ` son valores fijos que exige Google. `origins` restringe desde
 * qué dominios se puede usar el enlace.
 */
export function construirCargaJwt(opciones: {
  cuentaServicioEmail: string;
  objeto: ReturnType<typeof construirObjeto>;
  origenes: string[];
  ahora?: Date;
}) {
  return {
    iss: opciones.cuentaServicioEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor((opciones.ahora ?? new Date()).getTime() / 1000),
    origins: opciones.origenes,
    payload: {
      loyaltyObjects: [opciones.objeto],
    },
  };
}

/** La URL a la que apunta el botón, con el JWT ya firmado. */
export function enlaceParaAgregar(jwtFirmado: string): string {
  return `https://pay.google.com/gp/v/save/${jwtFirmado}`;
}

/**
 * El parche que se manda al actualizar los sellos.
 *
 * Es un PATCH y no un PUT: así se cambia solo lo que depende de los sellos,
 * sin pisar el resto del objeto.
 *
 * OJO con el `barcode`: su `alternateText` también muestra el conteo, así que
 * hay que mandarlo en cada actualización. Si no, la tarjeta queda diciendo
 * "0/5 sellos" bajo el QR para siempre mientras el saldo de arriba sí sube.
 * Pasó de verdad el 2026-11-16. Y hay que mandar el barcode COMPLETO, porque
 * un PATCH sobre un objeto anidado reemplaza el objeto entero: mandar solo
 * `alternateText` borraría el tipo y el valor del código.
 */
export function construirParcheSellos(
  estado: EstadoClub,
  premio: string,
  urlTarjeta: string,
  /** Con diseño a medida, la imagen cambia con cada sello */
  plantillaImagenUrl?: string | null,
) {
  return {
    ...imagenPrincipal(plantillaImagenUrl, estado),
    loyaltyPoints: {
      label: 'Sellos',
      balance: { int: estado.sellos },
    },
    barcode: {
      type: 'QR_CODE',
      value: urlTarjeta,
      alternateText: `${estado.sellos}/${estado.objetivo} sellos`,
    },
    textModulesData: [
      {
        id: 'estado',
        header: estado.premioDisponible ? '¡Premio disponible!' : 'Te faltan',
        body: estado.premioDisponible
          ? `Pide tu premio en el local: ${premio}`
          : `${estado.faltan} ${estado.faltan === 1 ? 'sello' : 'sellos'} para: ${premio}`,
      },
    ],
  };
}
