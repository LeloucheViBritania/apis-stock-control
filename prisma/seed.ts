import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding...');

  // Nettoyer la base de données
  console.log('🧹 Nettoyage de la base de données...');
  await prisma.journalAudit.deleteMany();
  await prisma.ligneAjustementStock.deleteMany();
  await prisma.ajustementStock.deleteMany();
  await prisma.ligneTransfertStock.deleteMany();
  await prisma.transfertStock.deleteMany();
  await prisma.ligneBonCommandeAchat.deleteMany();
  await prisma.bonCommandeAchat.deleteMany();
  await prisma.ligneCommandeVente.deleteMany();
  await prisma.commandeVente.deleteMany();
  await prisma.detailCommande.deleteMany();
  await prisma.commande.deleteMany();
  await prisma.mouvementStock.deleteMany();
  await prisma.inventaire.deleteMany();
  await prisma.produitFournisseur.deleteMany();
  await prisma.produit.deleteMany();
  await prisma.categorie.deleteMany();
  await prisma.client.deleteMany();
  await prisma.fournisseur.deleteMany();
  await prisma.entrepot.deleteMany();
  await prisma.utilisateur.deleteMany();

  // Créer des utilisateurs
  console.log('👥 Création des utilisateurs...');
  
  const adminPassword = await bcrypt.hash('admin123', 10);
  const gestionnairePassword = await bcrypt.hash('gestionnaire123', 10);
  const employePassword = await bcrypt.hash('employe123', 10);

  const admin = await prisma.utilisateur.create({
    data: {
      nomUtilisateur: 'admin',
      email: 'admin@gestionstock.com',
      motDePasseHash: adminPassword,
      nomComplet: 'Administrateur Principal',
      role: 'ADMIN',
      tierAbonnement: 'PREMIUM',
      dateExpiration: new Date('2025-12-31'),
    },
  });

  const gestionnaire = await prisma.utilisateur.create({
    data: {
      nomUtilisateur: 'gestionnaire',
      email: 'gestionnaire@gestionstock.com',
      motDePasseHash: gestionnairePassword,
      nomComplet: 'Gestionnaire Stock',
      role: 'GESTIONNAIRE',
      tierAbonnement: 'GRATUIT',
    },
  });

  const employe = await prisma.utilisateur.create({
    data: {
      nomUtilisateur: 'employe',
      email: 'employe@gestionstock.com',
      motDePasseHash: employePassword,
      nomComplet: 'Employé Standard',
      role: 'EMPLOYE',
      tierAbonnement: 'GRATUIT',
    },
  });

  // Créer des catégories
  console.log('📦 Création des catégories...');
  
  const electronique = await prisma.categorie.create({
    data: {
      nom: 'Électronique',
      description: 'Produits électroniques',
    },
  });

  const ordinateurs = await prisma.categorie.create({
    data: {
      nom: 'Ordinateurs',
      description: 'Ordinateurs et accessoires',
      categorieParenteId: electronique.id,
    },
  });

  const telephones = await prisma.categorie.create({
    data: {
      nom: 'Téléphones',
      description: 'Smartphones et accessoires',
      categorieParenteId: electronique.id,
    },
  });

  const vetements = await prisma.categorie.create({
    data: {
      nom: 'Vêtements',
      description: 'Articles vestimentaires',
    },
  });

  // Créer des fournisseurs
  console.log('🏢 Création des fournisseurs...');
  
  const fournisseur1 = await prisma.fournisseur.create({
    data: {
      nom: 'TechSupply SA',
      personneContact: 'Jean Dupont',
      email: 'contact@techsupply.com',
      telephone: '+225 01 23 45 67',
      adresse: '123 Avenue des Technologies',
      ville: 'Abidjan',
      pays: 'Côte d\'Ivoire',
      conditionsPaiement: '30 jours net',
    },
  });

  const fournisseur2 = await prisma.fournisseur.create({
    data: {
      nom: 'Mode Import',
      personneContact: 'Marie Martin',
      email: 'contact@modeimport.com',
      telephone: '+225 02 34 56 78',
      adresse: '456 Boulevard du Commerce',
      ville: 'Abidjan',
      pays: 'Côte d\'Ivoire',
      conditionsPaiement: '45 jours fin de mois',
    },
  });

  // Créer des entrepôts (PREMIUM)
  console.log('🏭 Création des entrepôts...');
  
  const entrepotPrincipal = await prisma.entrepot.create({
    data: {
      nom: 'Entrepôt Principal',
      code: 'EP-001',
      adresse: '789 Zone Industrielle',
      ville: 'Abidjan',
      pays: 'Côte d\'Ivoire',
      responsableId: admin.id,
      capacite: 10000,
    },
  });

  const entrepotSecondaire = await prisma.entrepot.create({
    data: {
      nom: 'Entrepôt Secondaire',
      code: 'ES-002',
      adresse: '321 Avenue Logistique',
      ville: 'Abidjan',
      pays: 'Côte d\'Ivoire',
      responsableId: gestionnaire.id,
      capacite: 5000,
    },
  });

  // Créer des produits
  console.log('📱 Création des produits...');
  
  const produit1 = await prisma.produit.create({
    data: {
      reference: 'LAPTOP-001',
      nom: 'Laptop Dell XPS 13',
      description: 'Ordinateur portable haute performance',
      categorieId: ordinateurs.id,
      marque: 'Dell',
      uniteMesure: 'unite',
      poids: 1.2,
      coutUnitaire: 800,
      prixVente: 1200,
      niveauStockMin: 5,
      niveauStockMax: 50,
      pointCommande: 10,
      quantiteStock: 15,
    },
  });

  const produit2 = await prisma.produit.create({
    data: {
      reference: 'PHONE-001',
      nom: 'iPhone 14 Pro',
      description: 'Smartphone Apple dernière génération',
      categorieId: telephones.id,
      marque: 'Apple',
      uniteMesure: 'unite',
      poids: 0.2,
      coutUnitaire: 900,
      prixVente: 1400,
      niveauStockMin: 10,
      niveauStockMax: 100,
      pointCommande: 20,
      quantiteStock: 25,
    },
  });

  const produit3 = await prisma.produit.create({
    data: {
      reference: 'TSHIRT-001',
      nom: 'T-Shirt Coton Blanc',
      description: 'T-shirt 100% coton',
      categorieId: vetements.id,
      marque: 'GenericBrand',
      uniteMesure: 'unite',
      poids: 0.15,
      coutUnitaire: 5,
      prixVente: 15,
      niveauStockMin: 50,
      niveauStockMax: 500,
      pointCommande: 100,
      quantiteStock: 200,
    },
  });

  // Créer des inventaires (PREMIUM - multi-entrepôts)
  console.log('📊 Création des inventaires...');
  
  await prisma.inventaire.createMany({
    data: [
      { produitId: produit1.id, entrepotId: entrepotPrincipal.id, quantite: 10, quantiteReservee: 2, emplacement: 'A-01-01' },
      { produitId: produit1.id, entrepotId: entrepotSecondaire.id, quantite: 5, quantiteReservee: 0, emplacement: 'B-02-03' },
      { produitId: produit2.id, entrepotId: entrepotPrincipal.id, quantite: 20, quantiteReservee: 5, emplacement: 'A-01-02' },
      { produitId: produit2.id, entrepotId: entrepotSecondaire.id, quantite: 5, quantiteReservee: 0, emplacement: 'B-02-04' },
      { produitId: produit3.id, entrepotId: entrepotPrincipal.id, quantite: 150, quantiteReservee: 10, emplacement: 'A-03-01' },
      { produitId: produit3.id, entrepotId: entrepotSecondaire.id, quantite: 50, quantiteReservee: 0, emplacement: 'B-03-01' },
    ],
  });

  // Créer des clients
  console.log('👤 Création des clients...');
  
  const client1 = await prisma.client.create({
    data: {
      nom: 'Entreprise ABC',
      email: 'contact@abc.com',
      telephone: '+225 03 45 67 89',
      adresse: '111 Rue du Client',
      ville: 'Abidjan',
      pays: 'Côte d\'Ivoire',
    },
  });

  const client2 = await prisma.client.create({
    data: {
      nom: 'Société XYZ',
      email: 'contact@xyz.com',
      telephone: '+225 04 56 78 90',
      adresse: '222 Avenue Client',
      ville: 'Abidjan',
      pays: 'Côte d\'Ivoire',
    },
  });

  // Créer des mouvements de stock
  console.log('📝 Création des mouvements de stock...');
  
  await prisma.mouvementStock.createMany({
    data: [
      {
        produitId: produit1.id,
        entrepotId: entrepotPrincipal.id,
        typeMouvement: 'ENTREE',
        quantite: 10,
        raison: 'Réception commande fournisseur',
        coutUnitaire: 800,
        effectuePar: admin.id,
      },
      {
        produitId: produit2.id,
        entrepotId: entrepotPrincipal.id,
        typeMouvement: 'ENTREE',
        quantite: 20,
        raison: 'Réception commande fournisseur',
        coutUnitaire: 900,
        effectuePar: gestionnaire.id,
      },
      {
        produitId: produit1.id,
        entrepotId: entrepotPrincipal.id,
        typeMouvement: 'SORTIE',
        quantite: 2,
        raison: 'Vente client',
        effectuePar: employe.id,
      },
    ],
  });

  console.log('✅ Seeding terminé avec succès!');
  console.log('\n📋 Utilisateurs créés:');
  console.log('   Admin: admin / admin123 (PREMIUM)');
  console.log('   Gestionnaire: gestionnaire / gestionnaire123 (GRATUIT)');
  console.log('   Employé: employe / employe123 (GRATUIT)');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });