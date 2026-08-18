# Dasho

Dashboard léger pour regrouper les services auto-hébergés. Les données sont
stockées dans SQLite et les icônes téléchargées sont conservées dans `/data`.

## Démarrage rapide avec Docker

Prérequis : Docker Engine avec le plugin Compose.

```bash
mkdir -p data
docker compose up -d --build
```

Ouvrir ensuite <http://localhost:3000>. Le conteneur applique les migrations
Drizzle automatiquement avant de lancer le serveur Next.js. Les données
restent dans `./data`, même lors d'une recréation du conteneur.

Pour suivre les journaux ou arrêter l'instance :

```bash
docker compose logs -f dasho
docker compose down
```

## Variables d'environnement

| Variable | Valeur par défaut | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port HTTP écouté par Next.js. Le port publié dans Compose doit correspondre. |
| `DATABASE_URL` | `/data/dasho.db` | Chemin du fichier SQLite dans le conteneur. Garder ce chemin avec le volume `/data`. |
| `ALLOW_PRIVATE_TARGETS` | `false` | Autorise les résolutions de favicon vers des IP/réseaux privés. À n'activer que sur un réseau de confiance. |
| `ALLOW_SELF_SIGNED_CERTIFICATES` | `false` | Accepte les certificats TLS auto-signés lors de la récupération d’icônes et des contrôles d’état. Réservé au LAN/VPN. |
| `ENABLE_EXTERNAL_FAVICON_SERVICE` | `false` | Autorise le recours au service de favicon externe optionnel. |

Dans Compose, les valeurs peuvent être surchargées par un fichier `.env` ou
directement dans `docker-compose.yml`. Ne publiez pas le port sur Internet
sans authentification ou reverse proxy adapté.

## Installation locale (développement)

Prérequis : Node.js 22 et npm.

```bash
npm ci
$env:DATABASE_URL = "$PWD/data/dasho.db" # PowerShell
# export DATABASE_URL="$PWD/data/dasho.db" # Linux/macOS
npm run db:migrate
npm run dev
```

Le serveur de développement est disponible sur <http://localhost:3000>.
Pour charger les données de démonstration une seule fois :

```bash
npm run db:seed
```

## Migrations et mise à jour

Les fichiers SQL versionnés se trouvent dans `drizzle/`. Une mise à jour
standard consiste à reconstruire l'image :

```bash
docker compose up -d --build
```

La commande de démarrage lance `drizzle-kit migrate`; elle est idempotente et
ne réapplique pas les migrations déjà enregistrées. En installation locale,
utiliser `npm run db:migrate`. Ne supprimez pas `data/dasho.db` pour résoudre
une erreur de migration : faites d'abord une sauvegarde.

## Import depuis Dashy

Dasho ne modifie jamais le fichier Dashy source. Depuis **Réglages → Données →
Importer**, sélectionnez directement le fichier `conf.yml` ou `conf.yaml` du
volume Dashy. Les sections deviennent des dossiers et les éléments deviennent
des services ; les noms, URLs, descriptions, tags et icônes reconnues sont
repris automatiquement.

L’import ajoute les éléments à la configuration existante. Conservez le fichier
Dashy comme archive et vérifiez les liens avant d’activer les contrôles d’état.

Le même écran permet d’exporter toute la configuration Dasho en JSON et de la
réimporter sur une autre instance.

## Sauvegarde et restauration

Arrêtez brièvement Dasho pour obtenir une copie cohérente de SQLite et des
icônes :

```bash
docker compose stop dasho
tar -czf dasho-backup-$(date +%Y%m%d).tar.gz data
docker compose start dasho
```

Pour restaurer, arrêtez le service, remplacez le contenu de `data/` par celui
de l'archive, puis redémarrez :

```bash
docker compose stop dasho
tar -xzf dasho-backup-AAAAMMJJ.tar.gz
docker compose start dasho
```

Testez régulièrement une restauration sur une instance séparée. Les icônes
peuvent être supprimées pour réduire l'archive, mais elles seront téléchargées
à nouveau si le résolveur est sollicité.

## Vérifications utiles

```bash
npm run lint
npm test
npm run build
```

Le build Docker utilise Next.js en mode `standalone` et exécute le processus
avec l'utilisateur non privilégié `node`.
