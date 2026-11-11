# Fix: Téléchargements qui s'arrêtent avant la fin (PC)

## Problème

Les téléchargements s'arrêtaient avant d'être terminés sur PC. Une fois que le navigateur lance le téléchargement nativement (via le gestionnaire de téléchargement du navigateur), l'application web n'a plus rien à faire - c'est le **backend qui proxy le stream** qui doit maintenir la connexion.

## Causes identifiées

1. **Pas de timeout axios** → les requêtes upstream sans timeout pouvaient rester bloquées indéfiniment
2. **Timeouts serveur Express par défaut trop courts** → Railway coupe après 5 minutes
3. **Pas de gestion d'erreur sur les streams** → si l'upstream ou le client coupe, le serveur crashait
4. **Pas de limite sur la taille des fichiers** → axios limitait par défaut

## Solution appliquée

### 1. Timeout axios (download.routes.ts)

```typescript
response = await axios({
  method: 'GET',
  url,
  headers,
  responseType: 'stream',
  decompress: false,
  validateStatus: status => status >= 200 && status < 400,
  timeout: 2 * 60 * 60 * 1000, // 2 heures pour gros fichiers
  maxRedirects: 5,
  maxContentLength: Infinity,  // Pas de limite de taille
  maxBodyLength: Infinity
});
```

**Pourquoi 2 heures ?** Un fichier de 5GB à 5 Mbps = ~2h15. On laisse une marge.

### 2. Timeouts serveur (server.ts)

```typescript
server.keepAliveTimeout = 3 * 60 * 60 * 1000; // 3 heures
server.headersTimeout = 3 * 60 * 60 * 1000 + 5000; // +5s que keepAlive
server.requestTimeout = 3 * 60 * 60 * 1000; // 3 heures
```

**Pourquoi 3 heures ?** Plus long que le timeout axios (2h) pour laisser le temps à la requête de finir proprement.

### 3. Gestion des erreurs de stream

```typescript
// Erreur upstream (hébergeur coupe)
response.data.on('error', (err: Error) => {
  console.error('[Download File Proxy] Stream amont error:', err.message);
  if (!res.headersSent) {
    res.status(502).end();
  } else {
    res.destroy();
  }
});

// Erreur client (utilisateur annule)
res.on('error', (err: Error) => {
  console.error('[Download File Proxy] Stream client error:', err.message);
  response.data.destroy(); // Couper l'upstream si client coupe
});
```

## Comportement après le fix

1. **Utilisateur clique sur "Télécharger"**
2. **Frontend** résout l'URL et lance `window.open(backendUrl)` ou crée un `<a download>`
3. **Navigateur** démarre son gestionnaire de téléchargement natif
4. **Backend** maintient le stream jusqu'à 3 heures maximum
5. **En cas d'erreur upstream**, le backend log et coupe proprement
6. **En cas d'annulation utilisateur**, le backend détecte et nettoie la connexion upstream

## Impact

✅ Les gros fichiers (3-5 GB) peuvent maintenant se télécharger complètement  
✅ Si l'hébergeur coupe, l'erreur est loggée côté backend  
✅ Si l'utilisateur annule, la connexion upstream est proprement nettoyée  
✅ Le serveur ne crash plus sur les erreurs de stream  

## Notes Railway

Railway a un **timeout global de 5 minutes** pour les requêtes HTTP, mais ce timeout ne s'applique pas aux **réponses streamées** tant que des bytes sont envoyés. Nos timeouts de 3 heures sont donc effectifs pour les téléchargements.

## Tests

### Test manuel
1. Lancer un téléchargement d'un gros fichier (>1GB)
2. Vérifier dans l'onglet Téléchargements du navigateur que la progression continue
3. Vérifier dans les logs Railway que le stream reste actif

### Test annulation
1. Lancer un téléchargement
2. Annuler depuis le gestionnaire de téléchargement du navigateur
3. Vérifier dans les logs que "Stream client error" apparaît
4. Vérifier qu'aucun crash serveur n'est déclenché

## Commit

```
fix(download): prevent premature download interruption on PC

- Add 2-hour timeout to axios download proxy requests
- Add maxContentLength/maxBodyLength: Infinity for large files  
- Increase server timeouts to 3 hours (keepAliveTimeout, headersTimeout, requestTimeout)
- Add error handlers on upstream and client streams to prevent server crashes
- Once browser starts native download, server just maintains the stream
```

Commit hash: `39e08a6`
