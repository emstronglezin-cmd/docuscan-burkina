import { openDB, type IDBPDatabase } from 'idb';

/**
 * Stockage LOCAL (IndexedDB) des documents scannés. Conformément à la
 * priorité de confidentialité du cahier des charges, les PAGES SCANNÉES
 * et les PDF générés ne sont JAMAIS envoyés au backend : uniquement des
 * métadonnées (nom, nb pages, taille) sont journalisées côté serveur
 * lors de l'export, pour débiter le crédit.
 */
export interface LocalDocument {
  id: string;
  name: string;
  pages: string[]; // data URLs (image/jpeg) des pages, après recadrage/amélioration
  createdAt: number;
  pageCount: number;
  exported: boolean;
  pdfBlobBase64?: string;
  sizeBytes?: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB('docuscan-burkina', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveDocument(doc: LocalDocument) {
  const db = await getDb();
  await db.put('documents', doc);
}

export async function getAllDocuments(): Promise<LocalDocument[]> {
  const db = await getDb();
  const all = await db.getAll('documents');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDocument(id: string): Promise<LocalDocument | undefined> {
  const db = await getDb();
  return db.get('documents', id);
}

export async function deleteDocument(id: string) {
  const db = await getDb();
  await db.delete('documents', id);
}
