
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import { ArrowRight, Clock, Briefcase, Building, Users, Check, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const Index = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative bg-background py-20 md:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent z-0"></div>
          <div className="container px-4 mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 max-w-2xl animate-fade-in">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary mb-2">
                  <span className="font-medium">הפלטפורמה לשידוך משכנתאות</span>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                  מחברים יועצי משכנתאות עם סניפי בנקים
                </h1>
                <p className="text-xl text-muted-foreground">
                  ייעלו את תהליך המשכנתא על ידי שידוך בקשות הלוואה עם המוסדות המתאימים, הכל בפלטפורמה אחת.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button size="lg" asChild>
                    <Link to="/?tab=register">
                      הרשמה חינם <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/">התחברות</Link>
                  </Button>
                </div>
              </div>
              <div className="relative lg:order-last">
                <div className="rounded-2xl overflow-hidden border shadow-lg bg-card animate-fade-in">
                  <img
                    src="https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2073&q=80"
                    alt="Mortgage Advisors"
                    className="w-full h-72 lg:h-96 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end">
                    <div className="p-6 text-white">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Building className="h-4 w-4" />
                        </div>
                        <p className="font-semibold">פלטפורמת שידוך משכנתאות</p>
                      </div>
                      <h3 className="text-2xl font-bold mb-2">אישורי הלוואה מהירים יותר</h3>
                      <p className="text-white/80">התחבר ישירות למוסדות שמתאימים לצרכי הלקוחות שלך</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-10 -right-10 -z-10 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-slate-50">
          <div className="container px-4 mx-auto">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">איך זה עובד?</h2>
              <p className="text-xl text-muted-foreground">
                הפלטפורמה שלנו מייעלת את החיבור בין יועצי משכנתאות למוסדות פיננסיים
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="hover-scale border-transparent shadow-md bg-white">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Briefcase className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">הגשת בקשות הלוואה</h3>
                  <p className="text-muted-foreground">
                    יועצי משכנתאות יכולים לשלוח בקשות הלוואה חדשות בטופס פשוט ומהיר.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-scale border-transparent shadow-md bg-white">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Building className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">שידוך עם בנקים</h3>
                  <p className="text-muted-foreground">
                    נציגי בנק מקבלים התראות בזמן אמת על בקשות חדשות ויכולים לסנן לפי הקריטריונים שלהם.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-scale border-transparent shadow-md bg-white">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Check className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">חיבורים מאובטחים</h3>
                  <p className="text-muted-foreground">
                    כשיש עניין הדדי, שני הצדדים יכולים לתקשר ישירות דרך הפלטפורמה המאובטחת שלנו.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20">
          <div className="container px-4 mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary mb-2">
                  <span className="font-medium">תהליך פשוט</span>
                </div>
                <h2 className="text-3xl font-bold leading-tight">
                  יתרונות ליועצים ולבנקאים
                </h2>
                <p className="text-xl text-muted-foreground">
                  הפלטפורמה שלנו יוצרת ערך לכל המשתתפים בתהליך המשכנתא
                </p>

                <div className="space-y-4 mt-8">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1">חיסכון בזמן</h3>
                      <p className="text-muted-foreground">צמצמו את הזמן שמושקע בחיפוש אופציות משכנתא במוסדות שונים.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="mt-1 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1">שידוך מושלם</h3>
                      <p className="text-muted-foreground">שדכו לקוחות עם מוסדות שבאמת מתעניינים בתיק הספציפי שלכם.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="mt-1 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1">תקשורת ישירה</h3>
                      <p className="text-muted-foreground">כל האינטראקציות במקום אחד, עם עדכוני סטטוס ברורים לכל בקשה.</p>
                    </div>
                  </div>
                </div>

                <Button size="lg" className="mt-6" asChild>
                  <Link to="/?tab=register">הצטרפו עכשיו <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-0 overflow-hidden shadow-lg hover-scale">
                  <div className="h-48 bg-gradient-to-br from-blue-500 to-blue-700 p-8 text-white flex flex-col justify-between">
                    <h3 className="text-2xl font-bold">ליועצי משכנתאות</h3>
                    <div className="flex justify-between items-end">
                      <p className="text-white/80">הגישו תיקים תוך דקות</p>
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
                <Card className="border-0 overflow-hidden shadow-lg hover-scale mt-8 sm:mt-12">
                  <div className="h-48 bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 text-white flex flex-col justify-between">
                    <h3 className="text-2xl font-bold">לסניפי בנק</h3>
                    <div className="flex justify-between items-end">
                      <p className="text-white/80">מצאו את השידוכים המושלמים</p>
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
                <Card className="border-0 overflow-hidden shadow-lg hover-scale">
                  <div className="h-48 bg-gradient-to-br from-amber-500 to-amber-700 p-8 text-white flex flex-col justify-between">
                    <h3 className="text-2xl font-bold">עדכונים בזמן אמת</h3>
                    <div className="flex justify-between items-end">
                      <p className="text-white/80">הישארו מעודכנים בכל פעילות</p>
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
                <Card className="border-0 overflow-hidden shadow-lg hover-scale mt-8 sm:mt-12">
                  <div className="h-48 bg-gradient-to-br from-violet-500 to-violet-700 p-8 text-white flex flex-col justify-between">
                    <h3 className="text-2xl font-bold">פלטפורמה מאובטחת</h3>
                    <div className="flex justify-between items-end">
                      <p className="text-white/80">פרטיות ואבטחה מובנים</p>
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-primary to-primary/80 text-white">
          <div className="container px-4 mx-auto text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-4xl font-bold mb-4">מוכנים לשדרג את תהליך המשכנתא?</h2>
              <p className="text-xl opacity-90 mb-8">
                הירשמו לפלטפורמה היום ותחוו דרך יעילה יותר לחבר יועצי משכנתאות עם מוסדות פיננסיים.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="default" className="bg-white text-primary hover:bg-white/90" asChild>
                  <Link to="/?tab=register">צור חשבון</Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
                  <Link to="/">התחבר</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Quick access button that appears when scrolled */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-transform duration-300 ${isScrolled ? 'translate-y-0' : 'translate-y-20'}`}
      >
        <Link to="/register">
          <Button size="lg" className="rounded-full shadow-lg h-14 w-14 p-0">
            <ArrowUpRight className="h-6 w-6" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;
