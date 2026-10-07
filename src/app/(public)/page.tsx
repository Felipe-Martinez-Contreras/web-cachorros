// Portada provisional de la Fase 0. La portada real (especificación 5.3) llega en la Fase 1.
export default function HomePage() {
  return (
    <main className="theme-dark grid min-h-svh place-items-center bg-(--bg) px-4 text-(--fg)">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Desde 1934</p>
        <h1 className="mt-3 font-display text-[clamp(2.25rem,6vw,4.5rem)] font-extrabold uppercase leading-[0.95] [font-stretch:75%]">
          Club Deportivo Los Cachorros
        </h1>
        <p className="mt-4 text-(--muted)">Estamos preparando el nuevo sitio del club.</p>
      </div>
    </main>
  )
}
