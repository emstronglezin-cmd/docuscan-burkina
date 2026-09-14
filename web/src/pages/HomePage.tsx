import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllDocuments, type LocalDocument } from '../lib/db';

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<LocalDocument[]>([]);

  useEffect(() => {
    getAllDocuments().then((all) => setDocs(all.slice(0, 3)));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-brand text-white px-5 py-6 rounded-b-3xl">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-white/80">Bonjour 👋</p>
            <p className="font-bold text-lg">{user?.fullName || user?.email}</p>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="text-sm text-white/80 underline">
            Déconnexion
          </button>
        </div>
        <div className="mt-5 bg-white/10 rounded-2xl p-4">
          <p className="text-sm text-white/80">Vos crédits</p>
          <p className="text-4xl font-bold">{user?.creditBalance ?? 0}</p>
        </div>
      </header>

      <main className="px-5 -mt-4">
        <Link
          to="/scanner"
          className="block bg-accent text-white text-center font-bold rounded-2xl py-4 shadow-lg mt-6"
        >
          📷 Scanner un document
        </Link>
        <p className="text-center text-gray-500 text-sm mt-2">50 FCFA / document</p>

        <Link
          to="/credits"
          className="block border-2 border-brand text-brand text-center font-semibold rounded-2xl py-3 mt-4"
        >
          + Acheter des crédits
        </Link>

        <div className="mt-8">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-800">Derniers documents</h2>
            <Link to="/documents" className="text-brand text-sm font-semibold">Voir tout</Link>
          </div>
          {docs.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun document pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-gray-400 text-sm">{d.pageCount} page(s)</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
