# Login-Setup Checkliste

## 1. Supabase Anon Key holen

1. Öffne https://supabase.com/dashboard/project/wfkzxqscskppfivqsgno
2. **Project Settings → API**
3. Kopiere den **anon / public** Key (beginnt mit `eyJ...`)

---

## 2. Lokal (Entwicklung)

Datei `.env.local` (wird nicht committed):

```
NEXT_PUBLIC_SUPABASE_URL=https://wfkzxqscskppfivqsgno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...deinen-echten-key-hier...
ADMIN_PW=dein-admin-passwort
```

---

## 3. Vercel Environment Variables

1. Öffne https://vercel.com → dein kidgo-pwa Projekt → **Settings → Environment Variables**
2. Füge hinzu (für **Production**, **Preview**, **Development**):

| Name | Wert |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wfkzxqscskppfivqsgno.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (echter Key aus Schritt 1) |
| `ADMIN_PW` | dein Admin-Passwort |

3. Nach dem Speichern: **Redeploy** auslösen (Deployments → ... → Redeploy)

---

## 4. Supabase Auth konfigurieren

Im Supabase Dashboard → **Authentication → URL Configuration**:

**Site URL:**
```
https://deine-vercel-url.vercel.app
```

**Redirect URLs (Allowlist):**
```
https://deine-vercel-url.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

> Ohne diese Einträge landen Magic-Link-Klicks auf einem Fehler.

---

## 5. Testen

1. Lokal: `npm run dev` → http://localhost:3000/login → Magic Link anfordern
2. Vercel: Deployment-URL aufrufen → Login testen
3. Checken ob die E-Mail ankommt (ggf. Spam-Ordner)
