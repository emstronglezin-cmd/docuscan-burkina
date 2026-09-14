import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceFcfa: number;
  isPopular: boolean;
}

/**
 * Achat de crédits via Saspay checkout hébergé. Les prix viennent
 * TOUJOURS de l'API (jamais codés en dur) — voir GET /credit-packs.
 * Le crédit du compte n'est appliqué QUE par confirmation serveur
 * (webhook signé Saspay ou vérification active), jamais par le frontend.
 */
export default function CreditsPage() {
  const { refreshMe } = useAuth();
  const navigate = useNavigate();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ packs: CreditPack[] }>('/credit-packs').then((res) => setPacks(res.packs));
  }, []);

  async function buy(packId: string) {
    setError(null);
    setLoadingPackId(packId);
    try {
      const payment = await api.post<{ id: string; checkoutUrl?: string }>('/payments/checkout', {
        creditPackId: packId,
      });
      if (payment.checkoutUrl) {
        // Redirection vers la page de paiement hébergée Saspay (mobile money/carte).
        window.location.href = payment.checkoutUrl;
      } else {
        setError('Impossible de générer le lien de paiement.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingPackId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-brand text-white px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>←</button>
        <h1 className="font-bold text-lg">Acheter des crédits</h1>
      </header>

      <main className="px-5 py-6 space-y-3">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {packs.map((pack) => (
          <div
            key={pack.id}
            className={`bg-white rounded-2xl shadow-sm p-4 flex justify-between items-center ${
              pack.isPopular ? 'ring-2 ring-accent' : ''
            }`}
          >
            <div>
              <p className="font-bold text-lg">{pack.name}</p>
              <p className="text-gray-500 text-sm">{pack.priceFcfa} FCFA</p>
              {pack.isPopular && <span className="text-accent text-xs font-semibold">Populaire</span>}
            </div>
            <button
              onClick={() => buy(pack.id)}
              disabled={loadingPackId === pack.id}
              className="bg-brand text-white rounded-xl px-4 py-2 font-semibold disabled:opacity-50"
            >
              {loadingPackId === pack.id ? '...' : 'Acheter'}
            </button>
          </div>
        ))}
        <p className="text-xs text-gray-400 text-center pt-4">
          Paiement sécurisé via Saspay (Orange Money, Moov Money, carte bancaire).
          Après paiement, revenez sur cette page : vos crédits seront ajoutés automatiquement.
        </p>
        <button
          onClick={() => refreshMe()}
          className="w-full border-2 border-brand text-brand rounded-xl py-2.5 font-semibold"
        >
          Rafraîchir mon solde
        </button>
      </main>
    </div>
  );
}
