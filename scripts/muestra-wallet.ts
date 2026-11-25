/**
 * Tarjetas de MUESTRA en Google Wallet, para ver un diseño en un celular real
 * antes de construirlo.
 *
 *   npx tsx scripts/muestra-wallet.ts
 *
 * Crea (o actualiza) UNA plantilla de muestra y una tarjeta por diseño, y
 * devuelve un enlace que las guarda todas. Mientras la cuenta de emisor esté
 * en modo demo, solo las puede guardar una cuenta de prueba o administradora
 * del emisor, y salen con "[TEST ONLY]".
 *
 * Ids FIJOS a propósito: Google no permite borrar plantillas ni tarjetas, así
 * que volver a correr el script actualiza las mismas en vez de dejar basura.
 */

import 'dotenv/config';

import { firmarRs256, obtenerTokenDeAcceso } from '../src/lib/jwt-google';
import { leerConfiguracionDelEntorno } from '../src/servicios/wallet/emisor';

const BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';
const IMG = 'https://sellofiel.app/muestras/tarjetas/market';

const DISENOS = ['Monedas de oro', 'La tienda', 'La cava', 'Ícono de la casa', 'El barril', 'El corte'];

async function main() {
  const config = leerConfiguracionDelEntorno();
  if (!config) throw new Error('No hay credenciales de Google Wallet en el .env');
  const { token } = await obtenerTokenDeAcceso({
    cuentaServicioEmail: config.cuentaServicioEmail,
    clavePrivada: config.clavePrivada,
  });

  const llamar = async (metodo: string, ruta: string, cuerpo?: unknown) => {
    const r = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return r;
  };
  const guardar = async (tipo: 'loyaltyClass' | 'loyaltyObject', cuerpo: { id: string }) => {
    const existe = (await llamar('GET', `/${tipo}/${encodeURIComponent(cuerpo.id)}`)).ok;
    const r = existe
      ? await llamar('PUT', `/${tipo}/${encodeURIComponent(cuerpo.id)}`, cuerpo)
      : await llamar('POST', `/${tipo}`, cuerpo);
    if (!r.ok) throw new Error(`${tipo} ${cuerpo.id}: ${r.status} ${await r.text()}`);
    console.log(`${existe ? 'actualizada' : 'creada'}: ${cuerpo.id}`);
  };

  const claseId = `${config.issuerId}.muestra-market-gourmet`;
  await guardar('loyaltyClass', {
    id: claseId,
    issuerName: 'The Market Gourmet',
    programName: 'Club The Market Gourmet',
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: '#111111',
    programLogo: {
      sourceUri: { uri: `${IMG}/logo-cuadrado.png` },
      contentDescription: { defaultValue: { language: 'es', value: 'Logo de The Market Gourmet' } },
    },
    wideProgramLogo: {
      sourceUri: { uri: `${IMG}/logo-ancho.png` },
      contentDescription: { defaultValue: { language: 'es', value: 'The Market Gourmet' } },
    },
    rewardsTierLabel: 'Premio',
    linksModuleData: {
      uris: [{ uri: 'https://wa.me/573155927944', description: 'Pedir por WhatsApp', id: 'whatsapp' }],
    },
  } as { id: string });

  const ids: string[] = [];
  for (const [i, nombre] of DISENOS.entries()) {
    const id = `${config.issuerId}.muestra-market-${i + 1}`;
    ids.push(id);
    await guardar('loyaltyObject', {
      id,
      classId: claseId,
      state: 'ACTIVE',
      accountName: `Muestra ${i + 1}: ${nombre}`,
      accountId: `muestra-${i + 1}`,
      loyaltyPoints: { label: 'Sellos', balance: { string: '7/10' } },
      heroImage: {
        sourceUri: { uri: `${IMG}/hero-${i + 1}.jpg` },
        contentDescription: { defaultValue: { language: 'es', value: '7 de 10 sellos' } },
      },
      barcode: { type: 'QR_CODE', value: 'https://sellofiel.app', alternateText: '7/10 sellos' },
      textModulesData: [{ id: 'estado', header: 'Te faltan', body: '3 sellos para: un corte madurado (ejemplo)' }],
    } as { id: string });
  }

  const jwt = firmarRs256(
    {
      iss: config.cuentaServicioEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [],
      payload: { loyaltyObjects: ids.map((id) => ({ id, classId: claseId })) },
    },
    config.clavePrivada,
  );
  console.log(`\nENLACE=https://pay.google.com/gp/v/save/${jwt}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
