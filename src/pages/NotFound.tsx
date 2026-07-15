
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.error(
        "404 Error: User attempted to access non-existent route:",
        location.pathname
      );
    }
  }, [location.pathname]);

  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="container px-4 py-16 text-center">
          <div className="mb-8 inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            <span className="text-4xl text-primary">404</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">הדף לא נמצא</h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto mb-8">
            לא הצלחנו למצוא את הדף שחיפשת. בוא נחזיר אותך למסלול.
          </p>
          <Button size="lg" asChild>
            <Link to="/">
              <ArrowRight className="ml-2 h-4 w-4" />
              חזרה לדף הבית
            </Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotFound;
