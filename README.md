# Boutique Hijama & Bien-être — Site e-commerce

Site e-commerce complet (frontend + backend + base de données), codé sur mesure en
Node.js/Express/SQLite, pour vendre des produits de hijama, massage, huiles et
accessoires bien-être au Maroc. Paiement à la livraison, commande possible via
le site ou directement sur WhatsApp.

## Sommaire

1. [Structure du projet](#1-structure-du-projet)
2. [Prérequis](#2-prérequis)
3. [Installation](#3-installation)
4. [Configuration (.env)](#4-configuration-env)
5. [Démarrer / arrêter le site](#5-démarrer--arrêter-le-site)
6. [Modifier WhatsApp et les réseaux sociaux](#6-modifier-whatsapp-et-les-réseaux-sociaux)
7. [Gérer produits, catégories, prix, stock](#7-gérer-produits-catégories-prix-stock)
8. [Modifier les frais de livraison](#8-modifier-les-frais-de-livraison)
9. [Accéder à l'espace admin](#9-accéder-à-lespace-admin)
10. [Exporter les commandes vers Excel](#10-exporter-les-commandes-vers-excel)
11. [Connecter Google Sheets](#11-connecter-google-sheets)
12. [Mettre le site en ligne avec votre nom de domaine](#12-mettre-le-site-en-ligne-avec-votre-nom-de-domaine)
13. [Notes importantes](#13-notes-importantes)

---

## 1. Structure du projet

```
hijama-store/
├── backend/                 # Serveur Node.js / API / base de données
│   ├── server.js            # Point d'entrée du serveur
│   ├── config.js            # Lecture des variables .env
│   ├── db/
│   │   ├── schema.sql       # Structure de la base de données
│   │   ├── database.js      # Connexion à la base SQLite
│   │   └── seed.js          # Données de démonstration
│   ├── middleware/          # Authentification admin, upload d'images
│   ├── routes/               # Toutes les routes de l'API (produits, commandes...)
│   └── utils/                # Fonctions utilitaires (validation, CSV, slugs)
├── frontend/                 # Le site que voient vos visiteurs
│   ├── index.html, produits.html, produit.html, panier.html, checkout.html...
│   ├── admin/                # Tableau de bord admin (/admin)
│   ├── css/, js/, images/, partials/
├── .env.example               # Modèle de configuration à copier en ".env"
├── package.json
└── README.md                  # Ce fichier
```

Le serveur Node.js sert à la fois l'API **et** les pages du site : un seul
processus à lancer, une seule adresse (`http://localhost:3000`).

---

## 2. Prérequis

- **Node.js** version 18 ou supérieure (recommandé : 20 ou plus récent).
  Vérifiez avec :
  ```
  node -v
  ```
  Si Node.js n'est pas installé, téléchargez-le sur https://nodejs.org
  (choisissez la version "LTS").

---

## 3. Installation

Ouvrez l'application **Terminal** sur votre Mac, puis :

```bash
# 1. Allez dans le dossier du projet (adaptez le chemin si besoin)
cd chemin/vers/hijama-store

# 2. Installez les dépendances (à faire une seule fois)
npm install

# 3. Créez votre fichier de configuration à partir du modèle
cp .env.example .env

# 4. Ouvrez .env et remplissez vos vraies informations (voir section 4)
open -e .env

# 5. Créez la base de données avec des données de démonstration
npm run seed
```

`npm run seed` crée les tables et ajoute 4 catégories, 12 produits d'exemple,
5 avis DEMO et des frais de livraison pour 5 villes — pour que le site ne soit
pas vide pendant que vous ajoutez vos vrais produits. Vous pourrez tout
remplacer depuis l'espace admin.

---

## 4. Configuration (.env)

Le fichier `.env` centralise toutes les informations propres à votre boutique.
Ouvrez-le avec `open -e .env` et remplissez notamment :

| Variable | Description |
|---|---|
| `STORE_NAME` | Le nom de votre boutique, affiché partout sur le site |
| `WHATSAPP_NUMBER` | Votre numéro WhatsApp, format international sans "+" ni espace (ex : `212612345678`) |
| `INSTAGRAM_URL`, `FACEBOOK_URL`, `TIKTOK_URL` | Liens vers vos réseaux sociaux |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Identifiants pour accéder à l'espace admin — **changez le mot de passe par défaut** |
| `DEFAULT_DELIVERY_FEE` | Frais de livraison appliqué pour toute ville non renseignée dans l'admin |

Tant qu'un champ garde sa valeur d'exemple (entre crochets, ex :
`[NUMERO WHATSAPP]`), le site l'affiche quand même pour que vous puissiez
tester, mais le serveur vous avertit dans le Terminal au démarrage. Pensez à
tout remplacer avant de partager le site.

**Après toute modification de `.env`, redémarrez le serveur** (voir section 5)
pour que les changements soient pris en compte.

---

## 5. Démarrer / arrêter le site

**Démarrer :**
```bash
cd chemin/vers/hijama-store
npm start
```
Le Terminal affiche `✅ [Nom de votre boutique] est en ligne sur
http://localhost:3000`. Ouvrez cette adresse dans votre navigateur.

**Arrêter :** cliquez dans la fenêtre du Terminal puis appuyez sur `Ctrl + C`.

**Pendant le développement**, `npm run dev` redémarre automatiquement le
serveur à chaque modification d'un fichier backend.

---

## 6. Modifier WhatsApp et les réseaux sociaux

Tout se passe dans le fichier `.env` (voir section 4) : `WHATSAPP_NUMBER`,
`INSTAGRAM_URL`, `FACEBOOK_URL`, `TIKTOK_URL`. Modifiez, enregistrez,
redémarrez le serveur. Un réseau sans lien renseigné n'apparaît simplement
pas dans le pied de page.

---

## 7. Gérer produits, catégories, prix, stock

Tout se fait depuis l'espace admin (voir section 9 pour vous connecter) :

- **Onglet "Produits"** : ajouter/modifier un produit (nom, description, prix,
  ancien prix, catégorie, stock, jusqu'à 6 photos, badges "Nouveau" /
  "Meilleure vente", visible ou masqué), ou le supprimer.
- **Onglet "Catégories"** : ajouter/modifier/supprimer une catégorie. La carte
  "Nouveautés" affichée sur le site est automatique : elle regroupe tous les
  produits cochés "Nouveau" et n'a pas besoin d'être créée manuellement.
- Les **prix et le stock** se modifient directement dans le formulaire produit.

Aucune ligne de code n'est nécessaire pour ces opérations du quotidien.

---

## 8. Modifier les frais de livraison

**Onglet "Livraison"** de l'espace admin : ajoutez une ville avec son frais,
ou modifiez/supprimez une ville existante. Toute ville non listée utilise
automatiquement `DEFAULT_DELIVERY_FEE` défini dans `.env`.

---

## 9. Accéder à l'espace admin

Rendez-vous sur `http://localhost:3000/admin/login` (ou cliquez sur
`/admin` une fois le site en ligne) et connectez-vous avec les identifiants
`ADMIN_USERNAME` / `ADMIN_PASSWORD` définis dans votre fichier `.env`.

Le tableau de bord regroupe : vue d'ensemble (statistiques, chiffre
d'affaires, alertes de stock faible), commandes (changement de statut :
Nouvelle commande → Confirmée → Préparation → Expédiée → Livrée, ou Annulée),
produits, catégories, avis clients et frais de livraison.

---

## 10. Exporter les commandes vers Excel

Dans l'onglet **"Commandes"** de l'espace admin, cliquez sur **"Exporter
CSV"**. Le fichier téléchargé s'ouvre directement dans Excel (ou Numbers) en
gardant les accents correctement affichés, avec une colonne par information
(date, client, téléphone, ville, produits, quantités, total, statut...).

---

## 11. Connecter Google Sheets

Chaque nouvelle commande peut s'ajouter automatiquement comme ligne dans une
feuille Google Sheets (nom du client, téléphone, ville, adresse, produits
achetés, total...), en plus de l'export CSV manuel (section 10). Aucun compte
développeur Google n'est nécessaire — juste 5 minutes via "Google Apps
Script", un outil gratuit intégré à Google Sheets.

**Mise en place :**

1. Créez une nouvelle feuille sur [sheets.google.com](https://sheets.google.com),
   nommez-la par exemple "Commandes [Nom de la boutique]".
2. Dans la première ligne, ajoutez ces titres de colonnes : `orderId`, `date`,
   `customerName`, `phone`, `city`, `address`, `region`, `comment`,
   `products`, `subtotal`, `deliveryFee`, `total`, `status`.
3. Menu **Extensions > Apps Script**. Effacez le code par défaut et collez :
   ```javascript
   function doPost(e) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     const data = JSON.parse(e.postData.contents);
     sheet.appendRow([
       data.orderId, data.date, data.customerName, data.phone, data.city,
       data.address, data.region, data.comment, data.products,
       data.subtotal, data.deliveryFee, data.total, data.status,
     ]);
     return ContentService.createTextOutput('OK');
   }
   ```
4. Cliquez **Déployer > Nouveau déploiement**, type **"Application Web"**.
   Réglez "Exécuter en tant que" sur vous-même, et "Qui a accès" sur
   **"Tout le monde"** (c'est cette URL secrète, pas le réglage d'accès, qui
   protège vos données : personne ne peut la deviner).
5. Copiez l'URL fournie (elle se termine par `/exec`) et collez-la dans votre
   fichier `.env` :
   ```
   GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXXXXXX/exec
   ```
6. Redémarrez le serveur (section 5). Chaque commande apparaît désormais dans
   votre feuille Google Sheets en quelques secondes, en plus d'être enregistrée
   dans le site.

Si l'envoi échoue pour une raison quelconque (pas d'internet, URL mal copiée),
la commande est tout de même enregistrée normalement sur le site — ce n'est
qu'une copie supplémentaire, jamais un point de blocage pour une vente.

---

## 12. Mettre le site en ligne avec votre nom de domaine

Le site est actuellement conçu pour tourner sur votre ordinateur
(`localhost`). Pour le rendre accessible à tout le monde avec votre propre
nom de domaine, les grandes étapes sont :

1. **Choisir un hébergeur** qui exécute du Node.js en continu, par exemple
   Render, Railway ou un VPS (OVH, Hetzner...). `localhost` ne fonctionne
   que sur votre propre machine.
2. **Déployer le code** (envoyer ce projet sur l'hébergeur, généralement via
   Git) et définir les mêmes variables que votre `.env` dans les réglages de
   l'hébergeur (jamais le fichier `.env` lui-même en ligne).
3. **Stocker la base de données de façon durable** : SQLite fonctionne très
   bien pour démarrer, mais sur la plupart des hébergeurs le disque est
   effacé à chaque redéploiement. Il faudra soit un "volume persistant" pour
   le fichier `store.db`, soit migrer vers une base hébergée (ex.
   PostgreSQL) si le trafic grandit — une évolution que la structure actuelle
   du code permet sans tout réécrire.
4. **Relier votre nom de domaine** (acheté chez un registrar comme
   OVH, IONOS, GoDaddy...) à l'hébergeur en suivant leur documentation DNS,
   puis activer le HTTPS (souvent automatique et gratuit via Let's Encrypt).
5. Repasser `cookie.secure` à `true` dans `backend/server.js` une fois le
   site servi en HTTPS, pour sécuriser la session admin.

Cette dernière étape technique gagne à être faite avec un développeur si
vous n'êtes pas à l'aise avec la ligne de commande ou les DNS.

---

## 13. Notes importantes

- **Aucune promesse médicale** : conformément à votre cahier des charges,
  aucun texte du site ne présente la hijama ou les produits comme un
  traitement médical ; la page "À propos" le précise explicitement.
- **Avis clients DEMO** : les 5 avis créés par `npm run seed` sont des
  exemples clairement identifiés (`is_demo`). Remplacez-les par de vrais
  avis dans l'onglet "Avis" dès que vous en avez.
- **Photos produits** : tant qu'une vraie photo n'est pas ajoutée depuis
  l'admin, un visuel générique avec la mention "Photo à ajouter" s'affiche
  à la place — jamais une fausse photo.
- **Sécurité des commandes** : les prix et totaux affichés sur le site ne
  sont jamais utilisés tels quels ; le serveur recalcule systématiquement
  le prix exact depuis la base de données à la création de chaque commande.
- Pour toute question technique, l'ensemble du code est commenté en
  français pour faciliter la prise en main par un développeur si besoin.
