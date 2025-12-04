-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'gestionnaire', 'employe');

-- CreateEnum
CREATE TYPE "TierAbonnement" AS ENUM ('gratuit', 'premium');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('en_attente', 'en_traitement', 'expedie', 'livre', 'annule');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('entree', 'sortie', 'ajustement', 'transfert', 'retour');

-- CreateEnum
CREATE TYPE "StatutBonCommande" AS ENUM ('brouillon', 'en_attente', 'approuve', 'recu', 'annule');

-- CreateEnum
CREATE TYPE "StatutTransfert" AS ENUM ('en_attente', 'en_transit', 'complete', 'annule');

-- CreateEnum
CREATE TYPE "RaisonAjustement" AS ENUM ('inventaire_physique', 'dommage', 'perte', 'trouve', 'correction', 'autre');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" SERIAL NOT NULL,
    "nom_utilisateur" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "mot_de_passe_hash" VARCHAR(255) NOT NULL,
    "nom_complet" VARCHAR(100),
    "role" "Role" NOT NULL DEFAULT 'employe',
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "tier_abonnement" "TierAbonnement" NOT NULL DEFAULT 'gratuit',
    "date_expiration" TIMESTAMP(3),
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "categorie_parente_id" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fournisseurs" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "personne_contact" VARCHAR(100),
    "email" VARCHAR(100),
    "telephone" VARCHAR(20),
    "adresse" TEXT,
    "ville" VARCHAR(50),
    "pays" VARCHAR(50),
    "numero_fiscal" VARCHAR(50),
    "conditions_paiement" VARCHAR(100),
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fournisseurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produits" (
    "id" SERIAL NOT NULL,
    "reference" VARCHAR(50) NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "categorie_id" INTEGER,
    "marque" VARCHAR(100),
    "unite_mesure" VARCHAR(20) NOT NULL DEFAULT 'unite',
    "poids" DECIMAL(10,2),
    "dimensions" VARCHAR(50),
    "code_barre" VARCHAR(100),
    "niveau_stock_min" INTEGER NOT NULL DEFAULT 0,
    "niveau_stock_max" INTEGER,
    "point_commande" INTEGER,
    "cout_unitaire" DECIMAL(10,2),
    "prix_vente" DECIMAL(10,2),
    "taux_taxe" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "quantite_stock" INTEGER NOT NULL DEFAULT 0,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100),
    "telephone" VARCHAR(20),
    "adresse" TEXT,
    "ville" VARCHAR(50),
    "pays" VARCHAR(50),
    "numero_fiscal" VARCHAR(50),
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commandes" (
    "id" SERIAL NOT NULL,
    "numero_commande" VARCHAR(50) NOT NULL,
    "client_id" INTEGER,
    "date_commande" DATE NOT NULL,
    "date_livraison" DATE,
    "statut" "StatutCommande" NOT NULL DEFAULT 'en_attente',
    "montant_total" DECIMAL(12,2),
    "cree_par" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "details_commande" (
    "id" SERIAL NOT NULL,
    "commande_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prix_unitaire" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "details_commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_stock" (
    "id" SERIAL NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "entrepot_id" INTEGER,
    "type_mouvement" "TypeMouvement" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "type_reference" VARCHAR(50),
    "reference_id" INTEGER,
    "raison" VARCHAR(255),
    "cout_unitaire" DECIMAL(10,2),
    "effectue_par" INTEGER,
    "date_mouvement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "mouvements_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrepots" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "adresse" TEXT,
    "ville" VARCHAR(50),
    "pays" VARCHAR(50),
    "responsable_id" INTEGER,
    "capacite" INTEGER,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entrepots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventaire" (
    "id" SERIAL NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "entrepot_id" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "quantite_reservee" INTEGER NOT NULL DEFAULT 0,
    "emplacement" VARCHAR(50),
    "derniere_verification" TIMESTAMP(3),
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produits_fournisseurs" (
    "id" SERIAL NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "fournisseur_id" INTEGER NOT NULL,
    "reference_fournisseur" VARCHAR(50),
    "delai_livraison_jours" INTEGER,
    "quantite_minimum_commande" INTEGER NOT NULL DEFAULT 1,
    "prix_unitaire" DECIMAL(10,2),
    "est_prefere" BOOLEAN NOT NULL DEFAULT false,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produits_fournisseurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bons_commande_achat" (
    "id" SERIAL NOT NULL,
    "numero_commande" VARCHAR(50) NOT NULL,
    "fournisseur_id" INTEGER NOT NULL,
    "entrepot_id" INTEGER NOT NULL,
    "date_commande" DATE NOT NULL,
    "date_livraison_prevue" DATE,
    "statut" "StatutBonCommande" NOT NULL DEFAULT 'brouillon',
    "montant_total" DECIMAL(12,2),
    "montant_taxe" DECIMAL(12,2),
    "notes" TEXT,
    "cree_par" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bons_commande_achat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_bon_commande_achat" (
    "id" SERIAL NOT NULL,
    "bon_commande_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "quantite_recue" INTEGER NOT NULL DEFAULT 0,
    "prix_unitaire" DECIMAL(10,2) NOT NULL,
    "taux_taxe" DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "lignes_bon_commande_achat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferts_stock" (
    "id" SERIAL NOT NULL,
    "numero_transfert" VARCHAR(50) NOT NULL,
    "entrepot_source_id" INTEGER NOT NULL,
    "entrepot_destination_id" INTEGER NOT NULL,
    "date_transfert" DATE NOT NULL,
    "statut" "StatutTransfert" NOT NULL DEFAULT 'en_attente',
    "notes" TEXT,
    "cree_par" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_completion" TIMESTAMP(3),

    CONSTRAINT "transferts_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_transfert_stock" (
    "id" SERIAL NOT NULL,
    "transfert_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "quantite_recue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lignes_transfert_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustements_stock" (
    "id" SERIAL NOT NULL,
    "numero_ajustement" VARCHAR(50) NOT NULL,
    "entrepot_id" INTEGER NOT NULL,
    "date_ajustement" DATE NOT NULL,
    "raison" "RaisonAjustement" NOT NULL,
    "notes" TEXT,
    "approuve_par" INTEGER,
    "cree_par" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustements_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_ajustement_stock" (
    "id" SERIAL NOT NULL,
    "ajustement_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "quantite_actuelle" INTEGER NOT NULL,
    "quantite_ajustee" INTEGER NOT NULL,

    CONSTRAINT "lignes_ajustement_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commandes_vente" (
    "id" SERIAL NOT NULL,
    "numero_commande" VARCHAR(50) NOT NULL,
    "client_id" INTEGER,
    "entrepot_id" INTEGER NOT NULL,
    "date_commande" DATE NOT NULL,
    "date_livraison" DATE,
    "statut" "StatutCommande" NOT NULL DEFAULT 'en_attente',
    "montant_total" DECIMAL(12,2),
    "cree_par" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commandes_vente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_commande_vente" (
    "id" SERIAL NOT NULL,
    "commande_vente_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prix_unitaire" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "lignes_commande_vente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" SERIAL NOT NULL,
    "utilisateur_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "nom_table" VARCHAR(50),
    "enregistrement_id" INTEGER,
    "anciennes_valeurs" JSONB,
    "nouvelles_valeurs" JSONB,
    "adresse_ip" VARCHAR(45),
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_nom_utilisateur_key" ON "utilisateurs"("nom_utilisateur");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "produits_reference_key" ON "produits"("reference");

-- CreateIndex
CREATE INDEX "produits_reference_idx" ON "produits"("reference");

-- CreateIndex
CREATE INDEX "produits_nom_idx" ON "produits"("nom");

-- CreateIndex
CREATE INDEX "produits_categorie_id_idx" ON "produits"("categorie_id");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_numero_commande_key" ON "commandes"("numero_commande");

-- CreateIndex
CREATE INDEX "commandes_numero_commande_idx" ON "commandes"("numero_commande");

-- CreateIndex
CREATE INDEX "commandes_statut_idx" ON "commandes"("statut");

-- CreateIndex
CREATE INDEX "mouvements_stock_produit_id_idx" ON "mouvements_stock"("produit_id");

-- CreateIndex
CREATE INDEX "mouvements_stock_date_mouvement_idx" ON "mouvements_stock"("date_mouvement");

-- CreateIndex
CREATE INDEX "mouvements_stock_type_mouvement_idx" ON "mouvements_stock"("type_mouvement");

-- CreateIndex
CREATE UNIQUE INDEX "entrepots_code_key" ON "entrepots"("code");

-- CreateIndex
CREATE INDEX "inventaire_quantite_idx" ON "inventaire"("quantite");

-- CreateIndex
CREATE INDEX "inventaire_entrepot_id_idx" ON "inventaire"("entrepot_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventaire_produit_id_entrepot_id_key" ON "inventaire"("produit_id", "entrepot_id");

-- CreateIndex
CREATE UNIQUE INDEX "produits_fournisseurs_produit_id_fournisseur_id_key" ON "produits_fournisseurs"("produit_id", "fournisseur_id");

-- CreateIndex
CREATE UNIQUE INDEX "bons_commande_achat_numero_commande_key" ON "bons_commande_achat"("numero_commande");

-- CreateIndex
CREATE INDEX "bons_commande_achat_numero_commande_idx" ON "bons_commande_achat"("numero_commande");

-- CreateIndex
CREATE INDEX "bons_commande_achat_statut_idx" ON "bons_commande_achat"("statut");

-- CreateIndex
CREATE INDEX "bons_commande_achat_fournisseur_id_idx" ON "bons_commande_achat"("fournisseur_id");

-- CreateIndex
CREATE INDEX "bons_commande_achat_date_commande_idx" ON "bons_commande_achat"("date_commande");

-- CreateIndex
CREATE UNIQUE INDEX "transferts_stock_numero_transfert_key" ON "transferts_stock"("numero_transfert");

-- CreateIndex
CREATE UNIQUE INDEX "ajustements_stock_numero_ajustement_key" ON "ajustements_stock"("numero_ajustement");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_vente_numero_commande_key" ON "commandes_vente"("numero_commande");

-- CreateIndex
CREATE INDEX "journal_audit_nom_table_enregistrement_id_idx" ON "journal_audit"("nom_table", "enregistrement_id");

-- CreateIndex
CREATE INDEX "journal_audit_date_creation_idx" ON "journal_audit"("date_creation");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_categorie_parente_id_fkey" FOREIGN KEY ("categorie_parente_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produits" ADD CONSTRAINT "produits_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "details_commande" ADD CONSTRAINT "details_commande_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "details_commande" ADD CONSTRAINT "details_commande_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_entrepot_id_fkey" FOREIGN KEY ("entrepot_id") REFERENCES "entrepots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_effectue_par_fkey" FOREIGN KEY ("effectue_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrepots" ADD CONSTRAINT "entrepots_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventaire" ADD CONSTRAINT "inventaire_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventaire" ADD CONSTRAINT "inventaire_entrepot_id_fkey" FOREIGN KEY ("entrepot_id") REFERENCES "entrepots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produits_fournisseurs" ADD CONSTRAINT "produits_fournisseurs_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produits_fournisseurs" ADD CONSTRAINT "produits_fournisseurs_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_commande_achat" ADD CONSTRAINT "bons_commande_achat_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_commande_achat" ADD CONSTRAINT "bons_commande_achat_entrepot_id_fkey" FOREIGN KEY ("entrepot_id") REFERENCES "entrepots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bons_commande_achat" ADD CONSTRAINT "bons_commande_achat_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_bon_commande_achat" ADD CONSTRAINT "lignes_bon_commande_achat_bon_commande_id_fkey" FOREIGN KEY ("bon_commande_id") REFERENCES "bons_commande_achat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_bon_commande_achat" ADD CONSTRAINT "lignes_bon_commande_achat_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferts_stock" ADD CONSTRAINT "transferts_stock_entrepot_source_id_fkey" FOREIGN KEY ("entrepot_source_id") REFERENCES "entrepots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferts_stock" ADD CONSTRAINT "transferts_stock_entrepot_destination_id_fkey" FOREIGN KEY ("entrepot_destination_id") REFERENCES "entrepots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferts_stock" ADD CONSTRAINT "transferts_stock_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_transfert_stock" ADD CONSTRAINT "lignes_transfert_stock_transfert_id_fkey" FOREIGN KEY ("transfert_id") REFERENCES "transferts_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_transfert_stock" ADD CONSTRAINT "lignes_transfert_stock_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustements_stock" ADD CONSTRAINT "ajustements_stock_entrepot_id_fkey" FOREIGN KEY ("entrepot_id") REFERENCES "entrepots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustements_stock" ADD CONSTRAINT "ajustements_stock_approuve_par_fkey" FOREIGN KEY ("approuve_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustements_stock" ADD CONSTRAINT "ajustements_stock_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_ajustement_stock" ADD CONSTRAINT "lignes_ajustement_stock_ajustement_id_fkey" FOREIGN KEY ("ajustement_id") REFERENCES "ajustements_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_ajustement_stock" ADD CONSTRAINT "lignes_ajustement_stock_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes_vente" ADD CONSTRAINT "commandes_vente_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes_vente" ADD CONSTRAINT "commandes_vente_entrepot_id_fkey" FOREIGN KEY ("entrepot_id") REFERENCES "entrepots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande_vente" ADD CONSTRAINT "lignes_commande_vente_commande_vente_id_fkey" FOREIGN KEY ("commande_vente_id") REFERENCES "commandes_vente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande_vente" ADD CONSTRAINT "lignes_commande_vente_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
