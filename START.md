# 🚀 Kidgo PWA - Quick Start Guide

## Schritt 1: Projekt auf deinem Computer öffnen

Das Projekt befindet sich hier:
```
~/Desktop/Projekt Kidgo/kidgo-pwa/
```

Öffne einen Terminal/CMD in diesem Verzeichnis.

## Schritt 2: Dependencies installieren

```bash
npm install
```

**Erste Installation dauert ~3-5 Minuten** (Download aller Pakete)

## Schritt 3: Environment Variablen setzen

Erstelle eine `.env.local` Datei mit deinen Supabase-Credentials:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://wfkzxqscskppfivqsgno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dein-anom-key-hier>
```

**Wo findest du diese?**
1. Öffne https://app.supabase.com
2. Wähle dein "lifeofpa-ai's Project"
3. Klicke auf "Settings" → "API"
4. Kopiere "URL" und "anon public" key

## Schritt 4: Dev Server starten

```bash
npm run dev
```

**Output sollte sein:**
```
> ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

## Schritt 5: Im Browser öffnen

Öffne: **http://localhost:3000**

Du solltest die Kidgo Landing Page mit Search/Filter sehen! 🎉

---

## 📱 Auf dem Handy testen?

1. Finde deine Computer-IP: `ipconfig` (Windows) oder `ifconfig` (Mac/Linux)
2. Öffne auf dem Handy: `http://<deine-ip>:3000`
3. Speichere als "App" (Install PWA)

---

## 🔧 Troubleshooting

**"npm: command not found"**
→ Node.js installieren von nodejs.org

**"Port 3000 already in use"**
→ `npm run dev -- -p 3001` (anderen Port verwenden)

**"SUPABASE_URL is required"**
→ Check `.env.local` - Variablen sind gesetzt?

---

## ✅ Nächste Schritte im Code

Datei: `app/page.tsx`
- [ ] Supabase Integration hinzufügen
- [ ] `handleSearch()` mit Datenbank verbinden
- [ ] Event-Liste darstellen
- [ ] Map-View bauen

---

**Fragen?** Öffne den Terminal und schreib:
```bash
npm run dev
```

Let's GO! 🚀
