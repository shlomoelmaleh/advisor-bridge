# BranchMatch (advisor-bridge)

אפליקציית ווב בעברית (RTL) שמחברת בין **יועצי משכנתאות** לבין **בנקאים** — התאמה אוטומטית בין תיקי לקוחות של יועצים לבין "תיאבון האשראי" של סניפי בנקים.

**Stack:** Vite · React 18 · TypeScript · shadcn/ui (Radix) · Tailwind · Supabase (Postgres + RLS, Auth, Edge Functions) · מסונכרן דו-כיוונית עם [Lovable](https://lovable.dev/projects/01331859-8ad9-4e28-b8ca-f9ebae35e498).

## התחלה מהירה

```sh
npm i
cp .env.example .env     # ולמלא ערכים מה-Dashboard של Supabase
npm run dev              # http://localhost:8080
```

## פקודות

| פקודה | תיאור |
|---|---|
| `npm run dev` | שרת פיתוח (פורט 8080) |
| `npm run build` | בניית פרודקשן |
| `npm run lint` | ESLint על כל הריפו |
| `npx tsx tests/<suite>.test.ts` | בדיקות אינטגרציה (ראו אזהרה למטה) |

### בדיקות — אזהרה

הבדיקות ב-`tests/` הן סקריפטים עצמאיים שרצים **מול פרויקט Supabase חי ומשנים נתונים אמיתיים** (יצירה/מחיקה של תיקים, התאמות והודעות). הן דורשות `.env` מלא כולל `SUPABASE_SERVICE_ROLE_KEY`. הריצו `CI=1` כדי לדלג על בדיקות ויזואליות אינטראקטיביות. אין test runner (vitest/jest) — כל סוויטה מורצת ישירות עם `tsx`.

## מבנה

- `src/pages/` — דפים לפי תפקיד: יועץ (`/advisor/*`), בנקאי (`/bank/*`), אדמין (`/admin/*`).
- `src/hooks/` — שכבת הדאטה (`useAuth`, `useCases`, `useAppetites`, `useMatches`, `useAdmin`).
- `supabase/migrations/` — **כל הלוגיקה העסקית הקריטית** (מנוע ההתאמות, RLS, טריגרים) חיה ב-SQL, לא ב-TypeScript.
- `supabase/functions/` — פונקציות Edge (Deno) לשליחת מיילים טרנזקציוניים דרך Resend.
- `scripts/` — כלי תחזוקה (למשל `rescore-legacy-matches.ts`, dry-run כברירת מחדל).

## מודל האבטחה — חובה לקרוא לפני נגיעה בהרשאות

**כל ההרשאות נאכפות בצד השרת** ע"י מדיניות RLS ופונקציות `SECURITY DEFINER` ב-Postgres. בדיקות תפקיד בצד הלקוח הן UX בלבד. פירוט מלא ב-[CLAUDE.md](CLAUDE.md).

## פריסה

- **פרונטאנד:** דרך Lovable (Share → Publish) או כל אחסון סטטי.
- **DB / פונקציות:** דרך Supabase CLI —
  ```sh
  npx supabase login
  npx supabase link --project-ref <project-ref>
  npx supabase db push               # מיגרציות
  npx supabase functions deploy      # פונקציות Edge
  ```

## CI

GitHub Actions (`.github/workflows/ci.yml`) מריץ lint + build על כל push/PR ל-main.
