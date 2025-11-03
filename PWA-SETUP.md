# 📱 PWA Setup - Installare l'App su Android

## ✅ Cosa è stato configurato

L'app è ora una **Progressive Web App (PWA)** installabile su Android, iOS e desktop!

### File creati:
- ✅ `public/manifest.json` - Configurazione PWA
- ✅ `public/sw.js` - Service Worker per funzionamento offline
- ✅ `index.html` - Aggiornato con meta tag PWA
- ✅ `generate-icons.sh` - Script per generare le icone

---

## 🎨 Come aggiungere la tua icona

### Passo 1: Carica il file icon.png

Hai detto di aver aggiunto un file `icon.png`. Assicurati che sia nella **cartella principale del progetto** (stessa cartella di questo file).

Il file deve essere:
- **Formato**: PNG con sfondo trasparente (preferibile) o solido
- **Dimensioni**: Almeno 512x512 pixel (quadrato)
- **Nome**: `icon.png`

### Passo 2: Genera le icone

Esegui lo script per generare automaticamente le icone nelle dimensioni richieste:

```bash
./generate-icons.sh
```

Questo creerà:
- `public/icon-192.png` (192×192px) - Per Android
- `public/icon-512.png` (512×512px) - Per Android e splash screen
- `public/icon.png` - Copia dell'originale

### Passo 3: Commit e Deploy

```bash
git add public/icon-*.png public/manifest.json public/sw.js index.html generate-icons.sh
git commit -m "Add PWA support with app icons"
git push
```

---

## 📲 Come installare l'app su Android

### Dopo il deploy su GitHub Pages:

1. **Apri il browser** (Chrome, Edge, Firefox) sul tuo Android
2. Vai all'URL: `https://filippodecarlo-cloud.github.io/Kanban/`
3. Tocca il **menu** (⋮) in alto a destra
4. Seleziona **"Aggiungi a schermata Home"** o **"Installa app"**
5. L'icona apparirà nella schermata Home!

### Funzionalità PWA:

✅ **Installabile**: Come un'app nativa
✅ **Offline**: Funziona anche senza internet (dopo il primo caricamento)
✅ **Schermo intero**: Senza barra del browser
✅ **Icona personalizzata**: La tua icon.png
✅ **Veloce**: File cached localmente

---

## 🔧 Personalizzazione

### Modificare il nome dell'app

Modifica `public/manifest.json`:

```json
{
  "name": "Il Tuo Nome App",
  "short_name": "Nome Breve",
  ...
}
```

### Modificare i colori

Nel file `public/manifest.json`:

```json
{
  "theme_color": "#4f46e5",  // Colore della barra superiore
  "background_color": "#ffffff"  // Colore di sfondo splash
}
```

---

## 🧪 Test in locale

Per testare la PWA in locale:

1. Build dell'app: `npm run build`
2. Serve la build: `npx serve dist`
3. Apri `http://localhost:3000` da mobile (stesso WiFi)
4. Prova ad installare

---

## ❓ Troubleshooting

### L'opzione "Installa app" non appare

- Verifica che l'app sia servita via **HTTPS** (GitHub Pages usa HTTPS automaticamente)
- Controlla che il file `manifest.json` sia accessibile
- Apri DevTools > Application > Manifest per vedere eventuali errori

### Le icone non si vedono

- Verifica che i file `icon-192.png` e `icon-512.png` esistano in `public/`
- Controlla i percorsi nel manifest
- Fai hard refresh (Ctrl+Shift+R)

### Service Worker non funziona

- Apri DevTools > Application > Service Workers
- Verifica che il SW sia registrato
- Prova "Unregister" e ricarica la pagina

---

## 📚 Risorse

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Manifest Generator](https://www.simicart.com/manifest-generator.html/)
- [Icon Generator](https://www.pwabuilder.com/imageGenerator)

---

🎉 **Ora hai una vera app installabile!**
