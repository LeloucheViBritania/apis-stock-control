-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'gestionnaire', 'employe');

-- CreateEnum
CREATE TYPE "TierAbonnement" AS ENUM ('gratuit', 'premium');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('en_attente', 'en_traitement', 'expedie', 'livre', 'annule', 'facturee');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('entree', 'sortie', 'ajustement', 'transfert', 'retour');

-- CreateEnum
CREATE TYPE "StatutBonCommande" AS ENUM ('brouillon', 'en_attente', 'approuve', 'recu', 'annule', 'livree', 'expediee', 'en_preparation');

-- CreateEnum
CREATE TYPE "StatutTransfert" AS ENUM ('en_attente', 'en_transit', 'complete', 'annule');

-- CreateEnum
CREATE TYPE "RaisonAjustement" AS ENUM ('inventaire_physique', 'dommage', 'perte', 'trouve', 'correction', 'autre');

-- CreateEnum
CREATE TYPE "StatutInventairePhysique" AS ENUM ('en_cours', 'en_pause', 'termine', 'valide', 'annule');

-- CreateEnum
CREATE TYPE "StatutLigneInventaire" AS ENUM ('en_attente', 'compte', 'valide', 'ecart');

-- CreateEnum
CREATE TYPE "StatutDevis" AS ENUM ('brouillon', 'envoye', 'accepte', 'refuse', 'expire', 'converti');

-- CreateEnum
CREATE TYPE "StatutSuiviLivraison" AS ENUM ('en_preparation', 'expedie', 'en_transit', 'en_livraison', 'livre', 'echec_livraison', 'retourne');

-- CreateEnum
CREATE TYPE "StatutClient" AS ENUM ('actif', 'inactif', 'bloque', 'suspendu', 'vip');

-- CreateEnum
CREATE TYPE "SegmentClient" AS ENUM ('nouveau', 'occasionnel', 'regulier', 'fidele', 'vip', 'inactif', 'a_risque');

-- CreateEnum
CREATE TYPE "TypeEvenementClient" AS ENUM ('creation', 'modification', 'blocage', 'deblocage', 'commande', 'paiement', 'retard_paiement', 'litige', 'note_ajoutee', 'segment_change');

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
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "categorie_parente_id" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fournisseurs" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "personne_contact" VARCHAR(100),
    "email" VARCHAR(100),
    "code" TEXT,
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
    "statut" "StatutClient" NOT NULL DEFAULT 'actif',
    "segment" "SegmentClient" NOT NULL DEFAULT 'nouveau',
    "limite_credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conditions_paiement" VARCHAR(50),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commandes" (
    "id" SERIAL NOT NULL,
    "numero_commande" VARCHAR(50) NOT NULL,
    "client_id" INTEGER,
    "entrepot_id" INTEGER,
    "date_commande" DATE NOT NULL,
    "date_livraison" DATE,
    "statut" "StatutCommande" NOT NULL DEFAULT 'en_attente',
    "montant_total" DECIMAL(12,2),
    "cree_par" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,
    "commande_parente_id" INTEGER,

    CONSTRAINT "commandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_commande" (
    "id" SERIAL NOT NULL,
    "commande_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prix_unitaire" DECIMAL(10,2) NOT NULL,
    "seuil_alerte" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lignes_commande_pkey" PRIMARY KEY ("id")
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
    "reference_externe" VARCHAR(100),

    CONSTRAINT "produits_fournisseurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bons_commande_achat" (
    "id" SERIAL NOT NULL,
    "numero_commande" VARCHAR(50) NOT NULL,
    "fournisseur_id" INTEGER NOT NULL,
    "entrepot_id" INTEGER NOT NULL,
    "date_commande" DATE,
    "date_livraison_prevue" DATE,
    "date_livraison_reelle" DATE,
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

-- CreateTable
CREATE TABLE "sessions_inventaire_physique" (
    "id" SERIAL NOT NULL,
    "reference" VARCHAR(50) NOT NULL,
    "entrepot_id" INTEGER NOT NULL,
    "categorie_id" INTEGER,
    "zone_emplacement" VARCHAR(50),
    "titre" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "statut" "StatutInventairePhysique" NOT NULL DEFAULT 'en_cours',
    "date_debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_fin" TIMESTAMP(3),
    "date_validation" TIMESTAMP(3),
    "total_produits" INTEGER NOT NULL DEFAULT 0,
    "produits_comptes" INTEGER NOT NULL DEFAULT 0,
    "produits_avec_ecart" INTEGER NOT NULL DEFAULT 0,
    "valeur_ecart_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cree_par" INTEGER NOT NULL,
    "valide_par" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_inventaire_physique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_inventaire_physique" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "inventaire_id" INTEGER,
    "emplacement" VARCHAR(50),
    "quantite_theorique" INTEGER NOT NULL,
    "quantite_comptee" INTEGER,
    "ecart" INTEGER,
    "cout_unitaire" DECIMAL(10,2) NOT NULL,
    "valeur_ecart" DECIMAL(12,2),
    "statut" "StatutLigneInventaire" NOT NULL DEFAULT 'en_attente',
    "notes" TEXT,
    "compte_par" INTEGER,
    "date_comptage" TIMESTAMP(3),
    "necessite_recomptage" BOOLEAN NOT NULL DEFAULT false,
    "quantite_recomptee" INTEGER,
    "recompte_par" INTEGER,
    "date_recomptage" TIMESTAMP(3),
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lignes_inventaire_physique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_inventaire_physique" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "details" JSONB,
    "utilisateur_id" INTEGER NOT NULL,
    "date_action" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historique_inventaire_physique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devis" (
    "id" SERIAL NOT NULL,
    "numero_devis" VARCHAR(50) NOT NULL,
    "client_id" INTEGER,
    "nom_client" VARCHAR(100),
    "email_client" VARCHAR(100),
    "telephone_client" VARCHAR(20),
    "adresse_client" TEXT,
    "entrepot_id" INTEGER,
    "date_devis" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_validite" DATE NOT NULL,
    "statut" "StatutDevis" NOT NULL DEFAULT 'brouillon',
    "montant_ht" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montant_taxe" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montant_ttc" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remise_globale" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "conditions_paiement" VARCHAR(255),
    "delai_livraison" VARCHAR(100),
    "notes" TEXT,
    "notes_internes" TEXT,
    "commande_id" INTEGER,
    "date_conversion" TIMESTAMP(3),
    "cree_par" INTEGER,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_devis" (
    "id" SERIAL NOT NULL,
    "devis_id" INTEGER NOT NULL,
    "produit_id" INTEGER NOT NULL,
    "description" VARCHAR(255),
    "quantite" INTEGER NOT NULL,
    "prix_unitaire" DECIMAL(10,2) NOT NULL,
    "remise" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taux_taxe" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "montant_ht" DECIMAL(12,2) NOT NULL,
    "montant_ttc" DECIMAL(12,2) NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lignes_devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_devis" (
    "id" SERIAL NOT NULL,
    "devis_id" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "ancien_statut" VARCHAR(50),
    "nouveau_statut" VARCHAR(50),
    "details" JSONB,
    "utilisateur_id" INTEGER,
    "date_action" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historique_devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suivi_livraison" (
    "id" SERIAL NOT NULL,
    "commande_id" INTEGER NOT NULL,
    "transporteur" VARCHAR(100),
    "numero_suivi" VARCHAR(100),
    "url_suivi" VARCHAR(255),
    "adresse_livraison" TEXT,
    "ville_livraison" VARCHAR(100),
    "pays_livraison" VARCHAR(50),
    "contact_livraison" VARCHAR(100),
    "telephone_livraison" VARCHAR(20),
    "statut" "StatutSuiviLivraison" NOT NULL DEFAULT 'en_preparation',
    "date_expedition" TIMESTAMP(3),
    "date_livraison_prevue" TIMESTAMP(3),
    "date_livraison_reelle" TIMESTAMP(3),
    "poids_total_kg" DECIMAL(10,2),
    "nombre_colis" INTEGER NOT NULL DEFAULT 1,
    "instructions_livraison" TEXT,
    "signature_requise" BOOLEAN NOT NULL DEFAULT false,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suivi_livraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evenements_livraison" (
    "id" SERIAL NOT NULL,
    "suivi_id" INTEGER NOT NULL,
    "statut" "StatutSuiviLivraison" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "localisation" VARCHAR(100),
    "date_evenement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evenements_livraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_modification_commande" (
    "id" SERIAL NOT NULL,
    "commande_id" INTEGER NOT NULL,
    "type_modification" VARCHAR(50) NOT NULL,
    "ligne_commande_id" INTEGER,
    "ancienne_valeur" JSONB,
    "nouvelle_valeur" JSONB,
    "raison" TEXT,
    "utilisateur_id" INTEGER,
    "date_modification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historique_modification_commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations_fournisseur" (
    "id" SERIAL NOT NULL,
    "fournisseur_id" INTEGER NOT NULL,
    "bon_commande_id" INTEGER,
    "note_qualite" DECIMAL(2,1) NOT NULL,
    "note_delai" DECIMAL(2,1) NOT NULL,
    "note_prix" DECIMAL(2,1) NOT NULL,
    "note_communication" DECIMAL(2,1) NOT NULL,
    "note_conformite" DECIMAL(2,1) NOT NULL,
    "note_globale" DECIMAL(2,1) NOT NULL,
    "commentaire" TEXT,
    "points_forts" TEXT,
    "points_ameliorer" TEXT,
    "recommande" BOOLEAN NOT NULL DEFAULT true,
    "evalue_par" INTEGER,
    "date_evaluation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistiques_fournisseur" (
    "id" SERIAL NOT NULL,
    "fournisseur_id" INTEGER NOT NULL,
    "moyenne_qualite" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "moyenne_delai" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "moyenne_prix" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "moyenne_communication" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "moyenne_conformite" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "moyenne_globale" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "nombre_evaluations" INTEGER NOT NULL DEFAULT 0,
    "nombre_recommandations" INTEGER NOT NULL DEFAULT 0,
    "nombre_commandes_total" INTEGER NOT NULL DEFAULT 0,
    "nombre_commandes_livrees" INTEGER NOT NULL DEFAULT 0,
    "nombre_commandes_en_retard" INTEGER NOT NULL DEFAULT 0,
    "montant_total_commandes" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "delai_livraison_moyen" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "taux_respect_delai" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taux_conformite" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "nombre_litiges" INTEGER NOT NULL DEFAULT 0,
    "rang" INTEGER,
    "categorie" VARCHAR(20),
    "derniere_mise_a_jour" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statistiques_fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents_fournisseur" (
    "id" SERIAL NOT NULL,
    "fournisseur_id" INTEGER NOT NULL,
    "bon_commande_id" INTEGER,
    "type_incident" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "impact" VARCHAR(20) NOT NULL,
    "montant_impact" DECIMAL(12,2),
    "statut" VARCHAR(20) NOT NULL DEFAULT 'OUVERT',
    "resolution" TEXT,
    "date_resolution" TIMESTAMP(3),
    "signale_par" INTEGER,
    "date_incident" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocages_client" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "raison" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "montant_impaye" DECIMAL(12,2),
    "date_debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_fin" TIMESTAMP(3),
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "bloque_par" INTEGER NOT NULL,
    "debloque_par" INTEGER,
    "notes_deblocage" TEXT,

    CONSTRAINT "blocages_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encours_client" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "limite_credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montant_facture_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montant_paye" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "solde_actuel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montant_echu" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montant_non_echu" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "echu_0_30_jours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "echu_31_60_jours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "echu_61_90_jours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "echu_plus_90_jours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit_disponible" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taux_utilisation_credit" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "score_credit" INTEGER NOT NULL DEFAULT 100,
    "derniere_mise_a_jour" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encours_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistiques_client" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "nombre_commandes_total" INTEGER NOT NULL DEFAULT 0,
    "nombre_commandes_annee" INTEGER NOT NULL DEFAULT 0,
    "nombre_commandes_mois" INTEGER NOT NULL DEFAULT 0,
    "ca_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ca_annee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ca_mois" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "panier_moyen" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "frequence_achat" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "date_premiere_commande" TIMESTAMP(3),
    "date_derniere_commande" TIMESTAMP(3),
    "jours_depuis_dernier_achat" INTEGER NOT NULL DEFAULT 0,
    "delai_paiement_moyen" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "nombre_retards_paiement" INTEGER NOT NULL DEFAULT 0,
    "taux_paiement_a_temps" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "segment" "SegmentClient" NOT NULL DEFAULT 'nouveau',
    "valeur_client" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "potentiel_croissance" VARCHAR(20),
    "nombre_produits_achetes" INTEGER NOT NULL DEFAULT 0,
    "categorie_preferee" VARCHAR(100),
    "derniere_mise_a_jour" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statistiques_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_client" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "type_evenement" "TypeEvenementClient" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "details" JSONB,
    "reference_type" VARCHAR(50),
    "reference_id" INTEGER,
    "montant" DECIMAL(12,2),
    "utilisateur_id" INTEGER,
    "date_evenement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historique_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_client" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "titre" VARCHAR(100) NOT NULL,
    "contenu" TEXT NOT NULL,
    "priorite" VARCHAR(20) NOT NULL DEFAULT 'NORMALE',
    "categorie" VARCHAR(50),
    "date_rappel" TIMESTAMP(3),
    "rappel_effectue" BOOLEAN NOT NULL DEFAULT false,
    "cree_par" INTEGER NOT NULL,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_nom_utilisateur_key" ON "utilisateurs"("nom_utilisateur");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_resetPasswordToken_key" ON "utilisateurs"("resetPasswordToken");

-- CreateIndex
CREATE UNIQUE INDEX "fournisseurs_code_key" ON "fournisseurs"("code");

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
CREATE INDEX "commandes_client_id_idx" ON "commandes"("client_id");

-- CreateIndex
CREATE INDEX "commandes_entrepot_id_idx" ON "commandes"("entrepot_id");

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
CREATE INDEX "journal_audit_nom_table_enregistrement_id_idx" ON "journal_audit"("nom_table", "enregistrement_id");

-- CreateIndex
CREATE INDEX "journal_audit_date_creation_idx" ON "journal_audit"("date_creation");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_inventaire_physique_reference_key" ON "sessions_inventaire_physique"("reference");

-- CreateIndex
CREATE INDEX "sessions_inventaire_physique_entrepot_id_idx" ON "sessions_inventaire_physique"("entrepot_id");

-- CreateIndex
CREATE INDEX "sessions_inventaire_physique_statut_idx" ON "sessions_inventaire_physique"("statut");

-- CreateIndex
CREATE INDEX "sessions_inventaire_physique_date_debut_idx" ON "sessions_inventaire_physique"("date_debut");

-- CreateIndex
CREATE INDEX "lignes_inventaire_physique_session_id_idx" ON "lignes_inventaire_physique"("session_id");

-- CreateIndex
CREATE INDEX "lignes_inventaire_physique_statut_idx" ON "lignes_inventaire_physique"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "lignes_inventaire_physique_session_id_produit_id_key" ON "lignes_inventaire_physique"("session_id", "produit_id");

-- CreateIndex
CREATE INDEX "historique_inventaire_physique_session_id_idx" ON "historique_inventaire_physique"("session_id");

-- CreateIndex
CREATE INDEX "historique_inventaire_physique_date_action_idx" ON "historique_inventaire_physique"("date_action");

-- CreateIndex
CREATE UNIQUE INDEX "devis_numero_devis_key" ON "devis"("numero_devis");

-- CreateIndex
CREATE UNIQUE INDEX "devis_commande_id_key" ON "devis"("commande_id");

-- CreateIndex
CREATE INDEX "devis_numero_devis_idx" ON "devis"("numero_devis");

-- CreateIndex
CREATE INDEX "devis_statut_idx" ON "devis"("statut");

-- CreateIndex
CREATE INDEX "devis_client_id_idx" ON "devis"("client_id");

-- CreateIndex
CREATE INDEX "devis_date_devis_idx" ON "devis"("date_devis");

-- CreateIndex
CREATE INDEX "lignes_devis_devis_id_idx" ON "lignes_devis"("devis_id");

-- CreateIndex
CREATE INDEX "historique_devis_devis_id_idx" ON "historique_devis"("devis_id");

-- CreateIndex
CREATE INDEX "suivi_livraison_numero_suivi_idx" ON "suivi_livraison"("numero_suivi");

-- CreateIndex
CREATE INDEX "suivi_livraison_statut_idx" ON "suivi_livraison"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "suivi_livraison_commande_id_key" ON "suivi_livraison"("commande_id");

-- CreateIndex
CREATE INDEX "evenements_livraison_suivi_id_idx" ON "evenements_livraison"("suivi_id");

-- CreateIndex
CREATE INDEX "evenements_livraison_date_evenement_idx" ON "evenements_livraison"("date_evenement");

-- CreateIndex
CREATE INDEX "historique_modification_commande_commande_id_idx" ON "historique_modification_commande"("commande_id");

-- CreateIndex
CREATE INDEX "evaluations_fournisseur_fournisseur_id_idx" ON "evaluations_fournisseur"("fournisseur_id");

-- CreateIndex
CREATE INDEX "evaluations_fournisseur_date_evaluation_idx" ON "evaluations_fournisseur"("date_evaluation");

-- CreateIndex
CREATE INDEX "evaluations_fournisseur_note_globale_idx" ON "evaluations_fournisseur"("note_globale");

-- CreateIndex
CREATE UNIQUE INDEX "statistiques_fournisseur_fournisseur_id_key" ON "statistiques_fournisseur"("fournisseur_id");

-- CreateIndex
CREATE INDEX "incidents_fournisseur_fournisseur_id_idx" ON "incidents_fournisseur"("fournisseur_id");

-- CreateIndex
CREATE INDEX "incidents_fournisseur_statut_idx" ON "incidents_fournisseur"("statut");

-- CreateIndex
CREATE INDEX "blocages_client_client_id_idx" ON "blocages_client"("client_id");

-- CreateIndex
CREATE INDEX "blocages_client_est_actif_idx" ON "blocages_client"("est_actif");

-- CreateIndex
CREATE UNIQUE INDEX "encours_client_client_id_key" ON "encours_client"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "statistiques_client_client_id_key" ON "statistiques_client"("client_id");

-- CreateIndex
CREATE INDEX "historique_client_client_id_idx" ON "historique_client"("client_id");

-- CreateIndex
CREATE INDEX "historique_client_type_evenement_idx" ON "historique_client"("type_evenement");

-- CreateIndex
CREATE INDEX "historique_client_date_evenement_idx" ON "historique_client"("date_evenement");

-- CreateIndex
CREATE INDEX "notes_client_client_id_idx" ON "notes_client"("client_id");

-- CreateIndex
CREATE INDEX "notes_client_date_rappel_idx" ON "notes_client"("date_rappel");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_categorie_parente_id_fkey" FOREIGN KEY ("categorie_parente_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produits" ADD CONSTRAINT "produits_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_entrepot_id_fkey" FOREIGN KEY ("entrepot_id") REFERENCES "entrepots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_commande_parente_id_fkey" FOREIGN KEY ("commande_parente_id") REFERENCES "commandes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_commande" ADD CONSTRAINT "lignes_commande_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_inventaire_physique" ADD CONSTRAINT "sessions_inventaire_physique_entrepot_id_fkey" FOREIGN KEY ("entrepot_id") REFERENCES "entrepots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_inventaire_physique" ADD CONSTRAINT "sessions_inventaire_physique_categorie_id_fkey" FOREIGN KEY ("categorie_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_inventaire_physique" ADD CONSTRAINT "sessions_inventaire_physique_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions_inventaire_physique" ADD CONSTRAINT "sessions_inventaire_physique_valide_par_fkey" FOREIGN KEY ("valide_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_inventaire_physique" ADD CONSTRAINT "lignes_inventaire_physique_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions_inventaire_physique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_inventaire_physique" ADD CONSTRAINT "lignes_inventaire_physique_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_inventaire_physique" ADD CONSTRAINT "lignes_inventaire_physique_inventaire_id_fkey" FOREIGN KEY ("inventaire_id") REFERENCES "inventaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_inventaire_physique" ADD CONSTRAINT "lignes_inventaire_physique_compte_par_fkey" FOREIGN KEY ("compte_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_inventaire_physique" ADD CONSTRAINT "lignes_inventaire_physique_recompte_par_fkey" FOREIGN KEY ("recompte_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_inventaire_physique" ADD CONSTRAINT "historique_inventaire_physique_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions_inventaire_physique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_inventaire_physique" ADD CONSTRAINT "historique_inventaire_physique_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_entrepot_id_fkey" FOREIGN KEY ("entrepot_id") REFERENCES "entrepots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devis" ADD CONSTRAINT "devis_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_devis" ADD CONSTRAINT "lignes_devis_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_devis" ADD CONSTRAINT "lignes_devis_produit_id_fkey" FOREIGN KEY ("produit_id") REFERENCES "produits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_devis" ADD CONSTRAINT "historique_devis_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_devis" ADD CONSTRAINT "historique_devis_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suivi_livraison" ADD CONSTRAINT "suivi_livraison_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements_livraison" ADD CONSTRAINT "evenements_livraison_suivi_id_fkey" FOREIGN KEY ("suivi_id") REFERENCES "suivi_livraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_modification_commande" ADD CONSTRAINT "historique_modification_commande_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_modification_commande" ADD CONSTRAINT "historique_modification_commande_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_fournisseur" ADD CONSTRAINT "evaluations_fournisseur_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_fournisseur" ADD CONSTRAINT "evaluations_fournisseur_bon_commande_id_fkey" FOREIGN KEY ("bon_commande_id") REFERENCES "bons_commande_achat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_fournisseur" ADD CONSTRAINT "evaluations_fournisseur_evalue_par_fkey" FOREIGN KEY ("evalue_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statistiques_fournisseur" ADD CONSTRAINT "statistiques_fournisseur_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_fournisseur" ADD CONSTRAINT "incidents_fournisseur_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "fournisseurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_fournisseur" ADD CONSTRAINT "incidents_fournisseur_bon_commande_id_fkey" FOREIGN KEY ("bon_commande_id") REFERENCES "bons_commande_achat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents_fournisseur" ADD CONSTRAINT "incidents_fournisseur_signale_par_fkey" FOREIGN KEY ("signale_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocages_client" ADD CONSTRAINT "blocages_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocages_client" ADD CONSTRAINT "blocages_client_bloque_par_fkey" FOREIGN KEY ("bloque_par") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocages_client" ADD CONSTRAINT "blocages_client_debloque_par_fkey" FOREIGN KEY ("debloque_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encours_client" ADD CONSTRAINT "encours_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statistiques_client" ADD CONSTRAINT "statistiques_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_client" ADD CONSTRAINT "historique_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_client" ADD CONSTRAINT "historique_client_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_client" ADD CONSTRAINT "notes_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_client" ADD CONSTRAINT "notes_client_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
