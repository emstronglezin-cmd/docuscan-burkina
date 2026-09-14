import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { getDocument, saveDocument, type LocalDocument } from '../lib/db';
import { generatePdfFromPages } from '../lib/pdf';
import { estimateDataUrlBytes } from '../lib/image';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

/**
 * Écran de finalisation : génère le PDF localement (jsPDF), débite
 * 1 crédit via l'API (idempotent par documentReference = doc.id, donc
 * un double-clic ne débite jamais deux fois), puis propose
 * Ouvrir / Partager (Web Share API) / Enregistrer.
 */
export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();
  const [doc, setDoc] = useState<LocalDocument | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) getDocument(id).then((d) => setDoc(d ?? null));
  }, [id]);

  async function handleExport() {
    if (!doc) return;
    setError(null);
    setExporting(true);
    try {
      // 1. Génération PDF 100% locale.
      const blob = await generatePdfFromPages(doc.pages);
      setPdfBlob(blob);

      // 2. Débit du crédit côté serveur (idempotent par doc.id).
      if (!doc.exported) {
        await api.post('/documents/export', {
          documentReference: doc.id,
          fileName: `${doc.name}.pdf`,
          pageCount: doc.pageCount,
          fileSizeBytes: blob.size,
          platform: 'web',
        });
        const updated = { ...doc, exported: true, sizeBytes: blob.size };
        await saveDocument(updated);
        setDoc(updated);
        await refreshMe();
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'insufficient_credits') {
        setError('Crédits insuffisants. Achetez des crédits pour continuer.');
      } else {
        setError((err as Error).message);
      }
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    if (!pdfBlob || !doc) return;
    const file = new File([pdfBlob], `${doc.name}.pdf`, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: doc.name });
      } catch {
        // Annulation utilisateur, sans action.
      }
    } else {
      handleDownload();
    }
  }

  function handleDownload() {
    if (!pdfBlob || !doc) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.name}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleOpen() {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
  }

  if (!doc) return <div className="p-6">Chargement...</div>;

  const estimatedTotalBytes = doc.pages.reduce((sum, p) => sum + estimateDataUrlBytes(p), 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-brand text-white px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>←</button>
        <h1 className="font-bold text-lg">{doc.name}</h1>
      </header>

      <main className="px-5 py-6">
        {!pdfBlob ? (
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
            <p className="font-semibold text-lg mb-1">Votre document est prêt</p>
            <p className="text-gray-500 mb-4">{doc.pageCount} page(s) · ~{Math.round(estimatedTotalBytes / 1024)} Ko</p>
            <p className="text-gray-700 mb-1">Coût : 50 FCFA (1 crédit)</p>
            <p className="text-gray-700 mb-4">Crédits disponibles : {user?.creditBalance ?? '-'}</p>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            {error?.includes('insuffisants') ? (
              <button
                onClick={() => navigate('/credits')}
                className="w-full bg-accent text-white font-bold rounded-xl py-3"
              >
                Acheter des crédits
              </button>
            ) : (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full bg-brand text-white font-bold rounded-xl py-3 disabled:opacity-50"
              >
                {exporting ? 'Traitement...' : 'Exporter en PDF'}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
            <p className="font-semibold text-lg mb-4">Document créé avec succès ! 🎉</p>
            <div className="space-y-2">
              <button onClick={handleOpen} className="w-full border-2 border-brand text-brand rounded-xl py-2.5 font-semibold">Ouvrir</button>
              <button onClick={handleShare} className="w-full bg-brand text-white rounded-xl py-2.5 font-semibold">Partager</button>
              <button onClick={handleDownload} className="w-full border-2 border-gray-300 text-gray-700 rounded-xl py-2.5 font-semibold">Enregistrer</button>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-2">
          {doc.pages.map((p, i) => (
            <img key={i} src={p} alt={`Page ${i + 1}`} className="w-full h-28 object-cover rounded-lg" />
          ))}
        </div>
      </main>
    </div>
  );
}
