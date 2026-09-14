import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { fileToDataUrl, processImage } from '../lib/image';
import { saveDocument } from '../lib/db';

/**
 * Écran de scan multi-pages. Utilise <input type="file" accept="image/*"
 * capture="environment"> qui ouvre la caméra native sur mobile (Android/
 * iOS) et permet aussi d'importer une photo existante depuis la galerie
 * — comportement standard des PWA, sans dépendance native supplémentaire.
 */
export default function ScannerPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [docName, setDocName] = useState('Document');

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setProcessing(true);
    try {
      for (const file of Array.from(files)) {
        const raw = await fileToDataUrl(file);
        const processed = await processImage(raw, { maxDimension: 2000, enhance: true });
        setPages((prev) => [...prev, processed]);
      }
    } finally {
      setProcessing(false);
    }
  }

  function removePage(index: number) {
    setPages((prev) => prev.filter((_, i) => i !== index));
  }

  async function rotatePage(index: number) {
    const rotated = await processImage(pages[index], { rotationDeg: 90, enhance: false });
    setPages((prev) => prev.map((p, i) => (i === index ? rotated : p)));
  }

  async function handleFinish() {
    if (pages.length === 0) return;
    const doc = {
      id: uuidv4(),
      name: docName || 'Document',
      pages,
      createdAt: Date.now(),
      pageCount: pages.length,
      exported: false,
    };
    await saveDocument(doc);
    navigate(`/documents/${doc.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-brand text-white px-5 py-4">
        <h1 className="font-bold text-lg">Scanner un document</h1>
      </header>

      <main className="px-5 py-4">
        <input
          className="w-full border rounded-lg px-3 py-2 mb-4"
          placeholder="Nom du document (ex: Dossier_Bourse_2026)"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
        />

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="w-full bg-accent text-white font-bold rounded-2xl py-4 mb-6 disabled:opacity-50"
        >
          {processing ? 'Traitement...' : '📷 Ajouter une page'}
        </button>

        <div className="space-y-3">
          {pages.map((page, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-2 flex gap-3 items-center">
              <img src={page} alt={`Page ${i + 1}`} className="w-16 h-20 object-cover rounded-lg" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Page {i + 1}</p>
              </div>
              <button onClick={() => rotatePage(i)} className="text-brand text-sm px-2">↻</button>
              <button onClick={() => removePage(i)} className="text-red-500 text-sm px-2">✕</button>
            </div>
          ))}
        </div>
      </main>

      {pages.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-5 py-4">
          <button
            onClick={handleFinish}
            className="w-full bg-brand text-white font-bold rounded-2xl py-3.5"
          >
            Terminer ({pages.length} page{pages.length > 1 ? 's' : ''})
          </button>
        </div>
      )}
    </div>
  );
}
