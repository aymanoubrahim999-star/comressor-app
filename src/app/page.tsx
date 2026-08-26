import { CompressorTool } from "@/components/CompressorTool";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 pt-14 pb-24">
        <header className="text-center mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal-after mb-3">
            Gratuit · Sans upload · Sans inscription
          </p>
          <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-paper leading-[1.05]">
            Réduisez le poids de vos
            <br />
            images et PDF.
          </h1>
          <p className="mt-4 text-paper-dim text-sm sm:text-base max-w-lg mx-auto">
            Tout le traitement se fait directement sur votre appareil. Aucun
            fichier n&apos;est envoyé ni stocké sur un serveur.
          </p>
        </header>

        <CompressorTool />

        <section className="mt-24 max-w-2xl mx-auto grid sm:grid-cols-3 gap-6 text-center">
          <div>
            <p className="font-display font-extrabold text-2xl text-signal-after">100%</p>
            <p className="text-xs text-paper-dim mt-1">
              du traitement dans votre navigateur
            </p>
          </div>
          <div>
            <p className="font-display font-extrabold text-2xl text-signal-after">0</p>
            <p className="text-xs text-paper-dim mt-1">
              fichier envoyé sur un serveur
            </p>
          </div>
          <div>
            <p className="font-display font-extrabold text-2xl text-signal-after">∞</p>
            <p className="text-xs text-paper-dim mt-1">
              utilisations, sans limite ni compte
            </p>
          </div>
        </section>

        <section className="mt-24 max-w-2xl mx-auto border-t border-ink-line pt-10">
          <h2 className="font-display font-bold text-lg text-paper mb-3">
            Comment ça marche ?
          </h2>
          <p className="text-sm text-paper-dim leading-relaxed">
            Déposez une image (JPG, PNG, WebP) ou un fichier PDF, choisissez un
            niveau de compression, puis téléchargez le résultat. Pour les
            images, la qualité et les dimensions sont ajustées selon le
            préréglage choisi. Pour les PDF, le mode « Léger » conserve le
            texte sélectionnable ; les modes « Recommandé » et « Fort »
            transforment les pages en images pour obtenir une compression
            beaucoup plus forte, au prix du texte sélectionnable — utile
            surtout pour les PDF scannés ou riches en images.
          </p>
        </section>
      </div>
    </main>
  );
}
