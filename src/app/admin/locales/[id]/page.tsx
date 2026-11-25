/**
 * Ficha de un local para el administrador: /admin/locales/[id]
 */

import { notFound } from 'next/navigation';

import { BotonCopiar } from '@/app/panel/chips/copiar';
import { NOMBRE_TIPO } from '@/app/panel/chips/tipos';
import { MarcoAdmin } from '@/componentes/marco-admin';
import { SelectorSucursal } from '@/componentes/selector-sucursal';
import { exigirAdmin } from '@/lib/cookies-admin';
import { obtenerLocalAdmin, sellosObjetivoDe } from '@/servicios/admin';
import { direccionDelChip, listarChips } from '@/servicios/chips';
import { listarSucursales } from '@/servicios/sucursales';

import {
  accionBajaChipAdmin,
  accionCambiarActivo,
  accionCambiarEmitePases,
  accionCrearChipAdmin,
} from '../../acciones';
import { DisenoTarjeta } from './diseno';
import { RestablecerClave } from './restablecer';

export default async function PaginaLocalAdmin({ params }: PageProps<'/admin/locales/[id]'>) {
  await exigirAdmin();
  const { id } = await params;

  const local = await obtenerLocalAdmin(id);
  if (!local) notFound();

  const [chips, sedes, objetivo] = await Promise.all([
    listarChips(local.id),
    listarSucursales(local.id),
    sellosObjetivoDe(local.id),
  ]);
  const base = process.env.URL_PUBLICA ?? 'http://localhost:3011';

  return (
    <MarcoAdmin volver={{ href: '/admin', texto: 'Volver a los locales' }}>
      <div className="pila">
        <h1>{local.nombre}</h1>
        {!local.activo && <span className="etiqueta etiqueta--coral">Pausado</span>}
      </div>

      <div className="metricas">
        <div className="metrica" role="group" aria-label={`Clientes: ${local.clientes}`}>
          <span className="metrica__valor">{local.clientes}</span>
          <span className="metrica__etiqueta">Clientes</span>
        </div>
        <div className="metrica" role="group" aria-label={`Sellos este mes: ${local.sellosDelMes}`}>
          <span className="metrica__valor">{local.sellosDelMes}</span>
          <span className="metrica__etiqueta">Sellos este mes</span>
        </div>
      </div>

      <section className="hoja">
        <h2>Direcciones</h2>
        <p className="ayuda">Club del cliente</p>
        <p><a href={`${base}/c/${local.slug}/alta`}>{base}/c/{local.slug}/alta</a></p>
        <p className="ayuda">Panel del dueño ({local.duenoEmail ?? 'sin dueño'})</p>
        <p><a href={`${base}/panel/entrar`}>{base}/panel/entrar</a></p>
      </section>

      <section className="hoja" id="chips">
        <h2>Chips y códigos</h2>
        {chips.length === 0 ? (
          <p className="ayuda">Todavía no tiene ninguno.</p>
        ) : (
          <ul className="lista">
            {chips.map((chip) => (
              <li key={chip.id} className="fila" style={{ background: '#fff' }}>
                <span className="fila__titulo">{chip.objeto ?? 'Sin nombre'}</span>
                <span className="fila__meta">
                  {NOMBRE_TIPO[chip.tipo]} ·{' '}
                  {chip.ultimoUso ? `último sello ${chip.ultimoUso.toISOString().slice(0, 10)}` : 'nunca usado'}
                  {!chip.activo && ' · dado de baja'}
                </span>
                {chip.tipo !== 'pantalla' && (
                  <>
                    <code style={{ wordBreak: 'break-all' }}>{direccionDelChip(chip.token)}</code>
                    <BotonCopiar texto={direccionDelChip(chip.token)} />
                  </>
                )}
                <form action={accionBajaChipAdmin}>
                  <input type="hidden" name="localId" value={local.id} />
                  <input type="hidden" name="chipId" value={chip.id} />
                  <input type="hidden" name="activo" value={chip.activo ? 'no' : 'si'} />
                  <button type="submit" className="boton--texto boton--chico">
                    {chip.activo ? 'Dar de baja' : 'Reactivar'}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={accionCrearChipAdmin}>
          <input type="hidden" name="localId" value={local.id} />
          <div className="campo">
            <label htmlFor="objeto">Registrar uno nuevo: ¿dónde va?</label>
            <input id="objeto" name="objeto" placeholder="Barril del mozo 1" required />
          </div>
          <div className="campo">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue="nfc">
              <option value="nfc">Chip NFC</option>
              <option value="qr_impreso">QR impreso (solo para unirse)</option>
              <option value="pantalla">Pantalla de caja</option>
            </select>
          </div>
          <SelectorSucursal sucursales={sedes} />
          <button type="submit" className="boton--secundario">Registrar</button>
        </form>
      </section>

      <section className="hoja">
        <h2>Diseño de la tarjeta</h2>
        <DisenoTarjeta
          localId={local.id}
          objetivo={objetivo ?? 10}
          logoAnchoUrl={local.logoAnchoUrl}
          plantillaImagenUrl={local.plantillaImagenUrl}
        />
      </section>

      <section className="hoja">
        <h2>Contraseña del dueño</h2>
        <RestablecerClave localId={local.id} />
      </section>

      <section className="hoja">
        <h2>Google Wallet</h2>
        <p className="ayuda">
          {local.emitePases
            ? 'Emite tarjetas. Lo que se crea en Google no se puede borrar.'
            : 'No emite tarjetas. Actívalo solo cuando sea un cliente real: lo que se crea en Google no se puede borrar.'}
        </p>
        <form action={accionCambiarEmitePases}>
          <input type="hidden" name="localId" value={local.id} />
          <input type="hidden" name="emitePases" value={local.emitePases ? 'no' : 'si'} />
          <button type="submit" className="boton--secundario">
            {local.emitePases ? 'Dejar de emitir' : 'Empezar a emitir tarjetas'}
          </button>
        </form>
      </section>

      <section className="hoja">
        <h2>Estado</h2>
        <p className="ayuda">
          {local.activo
            ? 'Pausar deja sin servicio su club, sus chips y su panel. Los datos se conservan.'
            : 'Está pausado: sus clientes no pueden sumar sellos y el dueño no puede entrar.'}
        </p>
        <form action={accionCambiarActivo}>
          <input type="hidden" name="localId" value={local.id} />
          <input type="hidden" name="activo" value={local.activo ? 'no' : 'si'} />
          <button type="submit" className={local.activo ? 'boton--secundario' : ''}>
            {local.activo ? 'Pausar el local' : 'Reactivar el local'}
          </button>
        </form>
      </section>
    </MarcoAdmin>
  );
}

export const dynamic = 'force-dynamic';
