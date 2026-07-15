import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Building2,
  Zap,
  MessageCircle,
  ShieldCheck,
  Percent,
  Check,
} from 'lucide-react';
import { LogoMark } from '@/components/common/Logo';
import Footer from '@/components/common/Footer';
import './landing.css';

// Marketing landing page for guests (design approved in mockups/landing.html).
// Signed-in users never see this — RootRoute redirects them to their dashboard.

const Wordmark = () => (
  <span className="logo-word">
    Branch<span className="lm">Match</span>
  </span>
);

const CheckItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li>
    <span className="check-dot">
      <Check size={12} strokeWidth={3} />
    </span>
    {children}
  </li>
);

const Index = () => (
  <div className="landing-page" dir="rtl">
    {/* ─── Navbar (guest, dark) ─── */}
    <header className="lp-navbar">
      <div className="lp-container">
        <Link to="/" className="logo">
          <LogoMark size={34} scheme="onDark" />
          <Wordmark />
        </Link>
        <nav className="nav-links">
          <a className="nav-link" href="#hiw">איך זה עובד</a>
          <Link className="btn btn-ghost-light" to="/login">התחברות</Link>
          <Link className="btn btn-teal" to="/login?tab=register">הרשמה</Link>
        </nav>
      </div>
    </header>

    {/* ─── Dark hero ─── */}
    <section className="hero">
      <div className="lp-container">
        <div>
          <span className="eyebrow">
            <span className="dot" /> פלטפורמת השידוך למשכנתאות
          </span>
          <h1>
            התיק הנכון פוגש
            <br />
            את <span className="hl">הסניף הנכון</span>
          </h1>
          <p className="hero-sub">
            BranchMatch מחברת יועצי משכנתאות עם סניפי בנק על בסיס ביקוש אשראי
            אמיתי — התאמה מנוקדת, אנונימית ומהירה.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-teal btn-lg" to="/login?tab=register">הרשמה לפלטפורמה</Link>
            <Link className="btn btn-ghost-light btn-lg" to="/login">התחברות</Link>
          </div>
          <div className="hero-note">
            <ShieldCheck size={15} />
            פרטי התיקים נשארים אנונימיים עד להבעת עניין הדדי
          </div>
        </div>

        {/* Matching-engine visualization */}
        <div className="match-viz">
          <div className="viz-card tilt-a">
            <div className="viz-card-head">
              <span className="viz-icon"><FileText size={17} /></span>
              תיק לקוח
            </div>
            <div className="chips">
              <span className="chip">₪1.2M–1.5M</span>
              <span className="chip">LTV 60%</span>
              <span className="chip">שכיר</span>
              <span className="chip">אזור המרכז</span>
            </div>
          </div>

          <div className="connector">
            <div className="score-node">
              <span className="num">92</span>
              <span className="lbl">ציון התאמה</span>
            </div>
          </div>

          <div className="viz-card tilt-b">
            <div className="viz-card-head">
              <span className="viz-icon teal"><Building2 size={17} /></span>
              ביקוש סניף
            </div>
            <div className="chips">
              <span className="chip">הלוואה מ-₪1M</span>
              <span className="chip">LTV עד 70%</span>
              <span className="chip teal">ביקוש גבוה</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ─── How it works — two entry paths, one engine ─── */}
    <section className="hiw" id="hiw">
      <div className="lp-container">
        <div className="section-head">
          <span className="section-eyebrow">איך זה עובד</span>
          <h2>שני מסלולי פתיחה, מנוע התאמה אחד</h2>
          <p>
            לא משנה מי מתחיל — כל תיק חדש נבחן מול כל הביקושים הפעילים, וכל
            ביקוש חדש נבחן מול כל התיקים הפתוחים
          </p>
        </div>

        <div className="flow">
          <div className="flow-entries">
            <div className="flow-card advisor">
              <span className="tag">מסלול היועץ</span>
              <h3>
                <span className="viz-icon"><FileText size={17} /></span>
                היועץ מגיש תיק
              </h3>
              <p>פרטי התיק נחשפים לסניפים באופן אנונימי — בלי שם, בלי פרטים מזהים.</p>
            </div>
            <div className="flow-card bank">
              <span className="tag">מסלול הסניף</span>
              <h3>
                <span className="viz-icon teal"><Building2 size={17} /></span>
                הסניף מפרסם ביקוש
              </h3>
              <p>
                הסניף מגדיר מה הוא מחפש עכשיו — טווח הלוואה, LTV, סוג לווה, אזור
                ו-SLA — ויכול גם ליזום עניין בתיקים מהשוק הפתוח.
              </p>
            </div>
          </div>

          <div className="converge">
            <svg width="420" height="64" viewBox="0 0 420 64" aria-hidden="true">
              <path d="M105 0 C105 40 210 26 210 64" />
              <path d="M315 0 C315 40 210 26 210 64" />
            </svg>
          </div>

          <div className="engine-node">
            <h3>
              <Zap size={19} />
              מנוע ההתאמה מדרג
            </h3>
            <p>כל צמד תיק–ביקוש מקבל ציון התאמה שקוף; ציון 40 ומעלה יוצר התאמה אוטומטית.</p>
            <div className="chips">
              <span className="chip">סכום</span>
              <span className="chip">LTV</span>
              <span className="chip">סוג לווה</span>
              <span className="chip">אזור</span>
              <span className="chip">SLA</span>
            </div>
          </div>

          <div className="drop-line" />

          <div className="flow-final">
            <span className="viz-icon teal"><MessageCircle size={19} /></span>
            <div>
              <h3>עניין הדדי פותח שיחה</h3>
              <p>כששני הצדדים מביעים עניין נפתח צ'אט ישיר, והזהויות נחשפות לקראת סגירה.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ─── Two audiences ─── */}
    <section>
      <div className="lp-container">
        <div className="section-head">
          <span className="section-eyebrow">למי זה מתאים</span>
          <h2>בנוי לשני צידי העסקה</h2>
        </div>
        <div className="audiences">
          <div className="aud-card">
            <h3>
              <span className="viz-icon"><FileText size={18} /></span>
              ליועצי משכנתאות
            </h3>
            <ul className="aud-list">
              <CheckItem>חשיפה לביקוש האשראי האמיתי של סניפים פעילים</CheckItem>
              <CheckItem>בלי טלפונים קרים — ההתאמות המדורגות מגיעות אליך</CheckItem>
              <CheckItem>שוק ביקושים פתוח — רואים מה הסניפים מחפשים עכשיו</CheckItem>
            </ul>
          </div>
          <div className="aud-card">
            <h3>
              <span className="viz-icon teal"><Building2 size={18} /></span>
              לסניפי בנק
            </h3>
            <ul className="aud-list">
              <CheckItem>לידים מנוקדים שתואמים בדיוק את הביקוש שהגדרתם</CheckItem>
              <CheckItem>שוק תיקים אנונימי — אפשר ליזום עניין בלי לחכות</CheckItem>
              <CheckItem>שליטה מלאה בתנאי הסף וב-SLA של הסניף</CheckItem>
            </ul>
          </div>
        </div>
      </div>
    </section>

    {/* ─── Features strip ─── */}
    <section style={{ paddingTop: 0 }}>
      <div className="lp-container">
        <div className="features-strip">
          <div className="feat">
            <span className="viz-icon"><ShieldCheck size={18} /></span>
            <span>אנונימיות עד להתאמה</span>
          </div>
          <div className="feat">
            <span className="viz-icon teal"><Percent size={18} /></span>
            <span>ציון התאמה שקוף</span>
          </div>
          <div className="feat">
            <span className="viz-icon"><MessageCircle size={18} /></span>
            <span>צ'אט מאובטח</span>
          </div>
          <div className="feat">
            <span className="viz-icon teal"><Zap size={18} /></span>
            <span>עדכונים בזמן אמת</span>
          </div>
        </div>
      </div>
    </section>

    {/* ─── CTA band ─── */}
    <section className="cta-band">
      <div className="lp-container">
        <h2>מוכנים להתאמה הראשונה?</h2>
        <p>הצטרפו לפלטפורמה שמחברת בין הצדדים הנכונים בשוק המשכנתאות.</p>
        <div className="hero-ctas">
          <Link className="btn btn-teal btn-lg" to="/login?tab=register">הרשמה לפלטפורמה</Link>
          <Link className="btn btn-ghost-light btn-lg" to="/login">התחברות</Link>
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default Index;
