/**
 * Mini grafik garis SVG untuk pertumbuhan portofolio 7 hari.
 *
 * Komponen murni dari props (tanpa state/effect) sehingga aman dipakai di
 * server render maupun klien tanpa risiko hydration mismatch. Lebarnya
 * mengikuti lebar induk (`preserveAspectRatio="none"` + `w-full`) supaya kartu
 * tidak pernah melebar melebihi kolomnya di mobile maupun desktop.
 */
export default function GrowthChart({ series }: { series: number[] }) {
  const W = 280;
  const H = 72;
  const pad = 6;
  const data = series.length >= 2 ? series : [0, 0];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = (W - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return { x, y };
  });
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${H - pad} L${points[0].x.toFixed(1)},${H - pad} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-12 w-full sm:h-16"
      role="img"
      aria-label="Grafik pertumbuhan portofolio 7 hari terakhir"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Isian area: satu nada emerald transparan yang sangat halus.
            Tanpa gradien berlapis / mesh agar tren tetap terbaca namun
            tidak mencolok seperti grafik high-contrast. */}
        <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#growthFill)" />
      <path
        d={linePath}
        fill="none"
        stroke="#0d9488"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Titik akhir sederhana: satu inti kecil, tanpa cincin luar glowing. */}
      <circle cx={last.x} cy={last.y} r="3" fill="#0d9488" />
    </svg>
  );
}