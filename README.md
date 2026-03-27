# 🎪 Kidgo PWA - Events für Kinder

Progressive Web App für die Findung von Kinderevents in der Region Zürich.

## 🛠️ Tech Stack (100% kostenlos)

- **Next.js 15** - React Framework
- **TailwindCSS** - Utility-first CSS
- **TypeScript** - Type Safety
- **Supabase** (Free Tier) - Database
- **Vercel** oder **Netlify** (Free) - Deployment

## 📋 Setup

### 1. Dependencies installieren
```bash
npm install
```

### 2. Environment Variablen setzen
Kopiere `.env.example` zu `.env.local` und füge deine Supabase-Daten ein:
```bash
cp .env.example .env.local
```

Dann bearbeite `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://wfkzxqscskppfivqsgno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dein-anon-key>
```

### 3. Dev Server starten
```bash
npm run dev
```

Öffne http://localhost:3000

## 📱 PWA Features

- ✅ Installierbar auf Home Screen
- ✅ Offline-Funktionalität (kommend)
- ✅ Responsive Design
- ✅ Fast Load Times

## 🚀 Deployment

### Option 1: Vercel (empfohlen)
```bash
npm install -g vercel
vercel
```

### Option 2: Netlify
Verbinde dein GitHub Repo direkt mit Netlify.

## 🎯 MVP Features

- [x] Search & Filter UI
- [ ] Supabase Integration
- [ ] Event Display
- [ ] Map View (Leaflet)
- [ ] PWA Service Worker

---
**Autor:** Claude AI | **Lizenz:** MIT
