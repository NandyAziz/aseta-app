import Link from 'next/link';
import { QrCode, Rocket, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import HeroMascot3D from '@/components/HeroMascot3D';
import QrisRoundUpSimulator from '@/components/QrisRoundUpSimulator';

/** Alur kerja ASETA — dipakai pada bagian "Cara kerja". */
const LANGKAH = [
  {
    Icon: QrCode,
    step: '01',
    title: 'Bayar pakai QRIS',
    description: 'Belanja apa pun seperti biasa — cukup pindai kode QRIS untuk membayar.',
  },
  {
    Icon: TrendingUp,
    step: '02',
    title: 'Pembulatan otomatis',
    description:
      'Sisa pembayaran dibulatkan ke Rp5.000 terdekat, lalu diputar ke Emas Digital & Reksadana.',
  },
  {
    Icon: Sparkles,
    step: '03',
    title: 'Naga Aseta berevolusi',
    description:
      'Setiap kembalian memberi XP. Kumpulkan terus sampai Aseta menetas jadi naga dewasa.',
  },
];

/**
 * Landing page ASETA — memperkenalkan konsep auto round-up QRIS
 * lewat hero 3D, simulator interaktif, dan ajakan masuk ke dashboard.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-ivory text-forest">
      {/* Bilah atas — cukup logo ASETA di kiri */}
      <header className="sticky top-0 z-50 border-b border-line/60 bg-ivory/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-base">🐉</span>
            <span className="text-lg font-black tracking-tight text-forest">ASETA</span>
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-14 pt-10 sm:px-6 lg:pt-16">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3.5 py-1.5 text-xs font-bold text-brand ring-1 ring-brand/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                Auto Round-Up Investment
              </span>
              <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-forest sm:text-5xl lg:text-6xl">
                Ubah Kembalian Belanja Jadi <span className="text-brand">Naga Aset Digital</span>
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg lg:mx-0">
                Nabung otomatis lewat pembulatan QRIS sambil merawat naga Aseta sampai berevolusi.
              </p>
              <Link
                href="/dashboard"
                className="group mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-brand/30 transition-all duration-200 active:scale-95 hover:bg-brand-dark sm:text-base"
              >
                Masuk ke Dashboard
                <Rocket className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Panggung maskot 3D — bingkai rounded + bayangan dari HeroMascot3D */}
            <div className="relative mx-auto h-[340px] w-full max-w-lg sm:h-[420px] lg:h-[500px] lg:max-w-none">
              <HeroMascot3D />
            </div>
          </div>
        </section>

        {/* Simulator interaktif */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-black uppercase tracking-widest text-brand">
              Simulasi Interaktif
            </p>
            <h2 className="mt-2 text-2xl font-black text-forest sm:text-3xl">
              Coba hitung round-up-mu sendiri
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
              Geser nominal belanja dan lihat berapa yang otomatis kamu tabung beserta XP untuk
              Aseta.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-3xl">
            <QrisRoundUpSimulator />
          </div>
        </section>

        {/* Cara kerja */}
        <section className="border-y border-line bg-white/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-widest text-brand">Cara kerja</p>
              <h2 className="mt-2 text-2xl font-black text-forest sm:text-3xl">
                Tiga langkah, tanpa drama
              </h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {LANGKAH.map(({ Icon, step, title, description }) => (
                <div
                  key={step}
                  className="rounded-3xl border border-emerald-100/60 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand/10 text-brand">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-3xl font-black text-forest/15">{step}</span>
                  </div>
                  <h3 className="mt-4 text-base font-black text-forest sm:text-lg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* Kaki halaman */}
      <footer className="border-t border-line bg-ivory">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row sm:px-6">
          <p className="text-xs text-muted">© 2026 ASETA — Naga Penjelajah Asetmu</p>
          <p className="text-xs text-muted">
            Investasi mengandung risiko — pantau simulasimu langsung di dashboard.
          </p>
        </div>
      </footer>
    </div>
  );
}
