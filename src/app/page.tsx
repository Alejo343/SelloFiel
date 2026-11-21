/**
 * Portada de club.sellofiel.app.
 *
 * Casi nadie llega aquí: el cliente entra por el chip, el QR o el enlace de
 * WhatsApp, que lo llevan directo a su club. Solo sirve para no dar un 404 a
 * quien escriba el dominio a mano.
 */
export default function Inicio() {
  return (
    <main className="pagina">
      <h1>
        Sello <span style={{ color: 'var(--coral-ink)' }}>Fiel</span>
      </h1>
      <p className="texto-suave">Tarjeta de sellos digital para locales gastronómicos.</p>
      <p className="hoja">
        Para unirte al club de un local, escanea su código QR o apoya tu celular en su chip.
      </p>
      <a className="boton boton--secundario" href="https://sellofiel.app">
        Conocer Sello Fiel
      </a>
    </main>
  );
}
