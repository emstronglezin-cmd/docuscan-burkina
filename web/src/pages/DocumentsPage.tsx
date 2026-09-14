import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllDocuments, deleteDocument, type LocalDocument } from '../lib/db';

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<LocalDocument[]>([]);

  useEffect(() => {
    getAllDocuments().then(setDocs);
  }, []);

  async function handleDelete(id: string) {
    await deleteDocument(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-brand text-white px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>←</button>
        <h1 className="font-bold text-lg">Mes documents</h1>
      </header>
      <main className="px-5 py-4 space-y-3">
        {docs.length === 0 && <p className="text-gray-400 text-center mt-10">Aucun document</p>}
        {docs.map((d) => (
          <div key={d.id} className="bg-white rounded-xl shadow-sm p-3 flex justify-between items-center">
            <Link to={`/documents/${d.id}`} className="flex-1">
              <p className="font-semibold">{d.name}</p>
              <p className="text-gray-400 text-sm">
                {d.pageCount} page(s) · {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                {d.exported ? ' · Exporté ✅' : ''}
              </p>
            </Link>
            <button onClick={() => handleDelete(d.id)} className="text-red-500 px-2">
              🗑
            </button>
          </div>
        ))}
      </main>
    </div>
  );
}
