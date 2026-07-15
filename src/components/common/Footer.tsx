import React from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "@/components/common/Logo";

const Footer = () => {
  return (
    <footer
      dir="rtl"
      className="mt-auto border-t border-white/10 bg-[hsl(222_47%_12%)] py-10 text-white/80"
    >
      <div className="container px-4 mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5">
              <LogoMark size={30} scheme="onDark" />
              <span className="text-lg font-bold text-white">
                Branch<span className="text-[hsl(161_76%_45%)]">Match</span>
              </span>
            </Link>
            <p className="mt-2 text-sm text-white/55">
              מחברים יועצי משכנתאות עם סניפי בנקים
            </p>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <a href="/#hiw" className="text-white/75 hover:text-white transition-colors">
              איך זה עובד
            </a>
            <Link to="/login" className="text-white/75 hover:text-white transition-colors">
              התחברות
            </Link>
            <Link to="/login?tab=register" className="text-white/75 hover:text-white transition-colors">
              הרשמה
            </Link>
          </nav>
        </div>

        <div className="mt-8 border-t border-white/10 pt-4 text-xs text-white/45">
          © 2026 BranchMatch. כל הזכויות שמורות.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
