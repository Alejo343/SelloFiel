/**
 * El sello: el mismo dibujo dentado de la marca Sello Fiel, pero pintado con
 * `currentColor` para que tome el color de cada local.
 *
 * Es decorativo: el número de sellos siempre va escrito en texto aparte, que
 * es lo que leen los lectores de pantalla.
 */

const DIENTES: Array<[number, number]> = [
  [180, 100], [175.2, 127.4], [161.3, 151.4], [140, 169.3], [113.9, 178.8],
  [86.1, 178.8], [60, 169.3], [38.7, 151.4], [24.8, 127.4], [20, 100],
  [24.8, 72.6], [38.7, 48.6], [60, 30.7], [86.1, 21.2], [113.9, 21.2],
  [140, 30.7], [161.3, 48.6], [175.2, 72.6],
];

export function Sello({ iniciales }: { iniciales?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <circle cx="100" cy="100" r="80" />
        {DIENTES.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="14" />
        ))}
      </g>
      {/* La tinta interior usa el mismo color que el texto sobre el local:
          blanca sobre un granate, oscura sobre un amarillo pálido. */}
      <circle className="sello__tinta-trazo" cx="100" cy="100" r="64" fill="none" strokeOpacity="0.85" strokeWidth="6" />
      {iniciales ? (
        <text
          className="sello__tinta-relleno"
          x="100"
          y="122"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontWeight="700"
          fontSize="60"
        >
          {iniciales}
        </text>
      ) : (
        // Sin iniciales: una marca de verificación, que se lee como "sellado".
        <path
          className="sello__tinta-trazo"
          d="M70 102 L92 124 L132 80"
          fill="none"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
