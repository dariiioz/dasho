# Dasho

Dashboard léger pour regrouper les services auto-hébergés. Les données sont
stockées dans SQLite et les icônes téléchargées sont conservées dans `data/`.

## Installation de production avec PM2

Prérequis : Node.js 22, npm et PM2 sur un serveur Linux.

```bash
git clone https://github.com/dariiioz/dasho.git
cd dasho
npm ci
npm install --global pm2

mkdir -p data
export DATABASE_URL="$PWD/data/dasho.db"
export PORT=5555 # Choisissez ici le port voulu : 5000, 5555, etc.

npm run db:migrate
npm run build
pm2 start npm --name dasho -- start
pm2 save
pm2 startup
```

Exécutez ensuite la commande affichée par `pm2 startup` si PM2 vous en fournit
une. Dasho redémarrera alors après un redémarrage du serveur.

L'application est alors accessible directement sur
`http://IP_DU_SERVEUR:5555`. Remplacez `5555` par le port choisi ci-dessus.

Consultez les journaux et l'état avec `pm2 logs dasho` et `pm2 status`.

## Variables d'environnement

| Variable | Valeur par défaut | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port HTTP écouté par Next.js. Définissez par exemple `PORT=5555` pour changer de port. |
| `DATABASE_URL` | `data/dasho.db` depuis la racine du projet | Chemin absolu recommandé vers le fichier SQLite. |
| `ALLOW_PRIVATE_TARGETS` | `false` | Autorise les résolutions de favicon vers des IP/réseaux privés. À n'activer que sur un réseau de confiance. |
| `ALLOW_SELF_SIGNED_CERTIFICATES` | `false` | Accepte les certificats TLS auto-signés lors de la récupération d’icônes et des contrôles d’état. Réservé au LAN/VPN. |
| `ENABLE_EXTERNAL_FAVICON_SERVICE` | `false` | Autorise le recours au service de favicon externe optionnel. |

Pour les services internes à certificats auto-signés, activez
`ALLOW_PRIVATE_TARGETS=true` et `ALLOW_SELF_SIGNED_CERTIFICATES=true` dans
l'environnement PM2. Ne publiez pas Dasho directement sur Internet.

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

## Mise à jour

Les migrations SQL versionnées se trouvent dans `drizzle/`. Pour mettre à jour
l'instance :

```bash
git pull --ff-only
npm ci
DATABASE_URL="$PWD/data/dasho.db" npm run db:migrate
npm run build
PORT=5555 DATABASE_URL="$PWD/data/dasho.db" pm2 restart dasho --update-env
```

La migration est idempotente et ne réapplique pas les versions déjà
enregistrées. Ne supprimez pas `data/dasho.db` pour résoudre une erreur de
migration : faites d'abord une sauvegarde.

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
pm2 stop dasho
tar -czf dasho-backup-$(date +%Y%m%d).tar.gz data
pm2 start dasho
```

Pour restaurer, arrêtez le service, remplacez le contenu de `data/` par celui
de l'archive, puis redémarrez :

```bash
pm2 stop dasho
tar -xzf dasho-backup-AAAAMMJJ.tar.gz
pm2 start dasho
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

Le build Next.js utilise le mode `standalone`, ce qui conserve une installation
de production compacte.
