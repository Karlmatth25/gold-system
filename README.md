# GOLD SYSTEM v5 — Dashboard Automatisé XAU/USD

Stack : React (Vercel gratuit) + FastAPI (Render gratuit) + Twelve Data API (gratuit)

---

## DÉPLOIEMENT — 4 ÉTAPES

### Étape 1 — GitHub (5 min)
1. Créer un compte sur https://github.com
2. New repository → nom : `gold-system`
3. Sur votre Mac, ouvrir le Terminal et taper :

```bash
cd ~/Desktop
cp -r /tmp/gold-system ./gold-system
cd gold-system
git init
git add .
git commit -m "Gold System v5"
git remote add origin https://github.com/VOTRE_USERNAME/gold-system.git
git push -u origin main
```

---

### Étape 2 — Clé API Twelve Data (2 min, GRATUIT)
1. Aller sur https://twelvedata.com/register
2. Créer un compte gratuit (email suffit)
3. Copier votre clé API (ex: `abc123def456...`)
Plan gratuit : 800 requêtes/jour — largement suffisant (5 req toutes les 5 min = 1440/jour max)

---

### Étape 3 — Backend sur Render (5 min, GRATUIT)
1. Aller sur https://render.com → créer un compte
2. Cliquer "New +" → "Web Service"
3. Connecter votre compte GitHub → sélectionner le repo `gold-system`
4. Configurer :
   - **Name** : `gold-system-api`
   - **Root Directory** : `backend`
   - **Runtime** : Python 3
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan** : Free
5. Section "Environment Variables" → ajouter :
   - Key: `TWELVE_DATA_KEY`
   - Value: votre clé Twelve Data copiée à l'étape 2
6. Cliquer "Create Web Service"
7. Attendre le déploiement (2-3 min) → copier l'URL (ex: `https://gold-system-api.onrender.com`)

⚠️ Note : le plan gratuit Render s'endort après 15min d'inactivité.
Le premier chargement peut prendre 30-60 secondes (wake up).

---

### Étape 4 — Frontend sur Vercel (3 min, GRATUIT)
1. Aller sur https://vercel.com → créer un compte
2. Cliquer "New Project" → importer le repo `gold-system`
3. Configurer :
   - **Root Directory** : `frontend`
   - **Framework** : Create React App (auto-détecté)
4. Section "Environment Variables" → ajouter :
   - Key: `REACT_APP_API_URL`
   - Value: l'URL Render copiée à l'étape 3 (ex: `https://gold-system-api.onrender.com`)
5. Cliquer "Deploy"
6. Votre dashboard est en ligne ! Vercel vous donne une URL (ex: `gold-system.vercel.app`)

---

## STRUCTURE DU PROJET
```
gold-system/
├── backend/
│   ├── main.py           # FastAPI — lit DXY/TLT/VIX/SPX/Gold via Twelve Data
│   ├── requirements.txt  # fastapi, uvicorn, httpx
│   └── render.yaml       # Config déploiement Render
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.jsx       # Dashboard React complet (727 lignes)
    │   ├── index.css     # Styles globaux dark theme
    │   └── index.js      # Entry point
    ├── package.json
    └── vercel.json       # Config déploiement Vercel
```

---

## FONCTIONNALITÉS DU DASHBOARD
- ✅ Données macro temps réel : DXY, TLT, VIX, SPX, Gold (Twelve Data)
- ✅ Biais Long/Short calculé automatiquement (≥3/4 filtres)
- ✅ Sessions London/Overlap/NY avec horloge UTC temps réel
- ✅ Refresh automatique toutes les 5 minutes avec countdown
- ✅ Plan Long étape par étape
- ✅ Plan Short étape par étape
- ✅ Glossaire complet de tous les concepts
- ✅ Règles de discipline + grille qualité A+/B
- ✅ Interface dark theme professionnelle

---

## DONNÉES API
| Instrument | Symbole Twelve Data | MA utilisée | Signal Long |
|-----------|-------------------|-------------|-------------|
| DXY       | DX/USD            | MA20        | Sous MA20   |
| TLT       | TLT               | MA20        | Dessus MA20 |
| VIX       | VIX               | —           | > 20        |
| SPX       | SPX500            | MA50        | Sous MA50   |
| Gold      | XAU/USD           | MA20        | Référence   |

Délai données : 15 minutes (plan gratuit Twelve Data)
Cache serveur : 5 minutes (pour économiser les requêtes API)
