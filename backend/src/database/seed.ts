import 'dotenv/config';
import { AppDataSource } from './data-source';
import { CreditPack } from '../modules/credit-packs/entities/credit-pack.entity';

/**
 * Script de seed : crée les packs de crédits par défaut si absents.
 * Usage: npm run seed
 */
async function seed() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(CreditPack);

  const count = await repo.count();
  if (count === 0) {
    const defaults: Partial<CreditPack>[] = [
      { name: '1 crédit', credits: 1, priceFcfa: 50, sortOrder: 1 },
      { name: '5 crédits', credits: 5, priceFcfa: 250, sortOrder: 2 },
      { name: '10 crédits', credits: 10, priceFcfa: 500, sortOrder: 3, isPopular: true },
      { name: '20 crédits', credits: 20, priceFcfa: 1000, sortOrder: 4 },
    ];
    await repo.save(repo.create(defaults));
    console.log('✅ Packs de crédits par défaut créés');
  } else {
    console.log(`ℹ️  ${count} pack(s) déjà présent(s), aucune action`);
  }

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Erreur seed:', err);
  process.exit(1);
});
