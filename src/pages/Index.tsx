
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import { ArrowRight, Clock, Briefcase, Bank, Users, Check, ArrowUpRight } from 'lucide-react';
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
                  <span className="font-medium">Simplifying Mortgage Matching</span>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                  Connect Mortgage Advisors with Bank Representatives
                </h1>
                <p className="text-xl text-muted-foreground">
                  Streamline the mortgage process by matching loan requests with the right financial institutions, all in one platform.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button size="lg" asChild>
                    <Link to="/register">
                      Get Started <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/login">Sign In</Link>
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
                          <Bank className="h-4 w-4" />
                        </div>
                        <p className="font-semibold">Mortgage Matching Platform</p>
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Faster Loan Approvals</h3>
                      <p className="text-white/80">Connect directly with institutions that match your clients' needs</p>
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
              <h2 className="text-3xl font-bold mb-4">How It Works</h2>
              <p className="text-xl text-muted-foreground">
                Our platform streamlines the connection between mortgage advisors and financial institutions
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="hover-scale border-transparent shadow-md bg-white">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Briefcase className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Submit Loan Requests</h3>
                  <p className="text-muted-foreground">
                    Mortgage advisors can quickly submit new loan requests with all essential details through a simple form.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-scale border-transparent shadow-md bg-white">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Bank className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Match with Banks</h3>
                  <p className="text-muted-foreground">
                    Bank representatives receive real-time notifications about new requests and can filter by their criteria.
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-scale border-transparent shadow-md bg-white">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Check className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Secure Connections</h3>
                  <p className="text-muted-foreground">
                    When there's mutual interest, both parties can communicate directly through our secure platform.
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
                  <span className="font-medium">Simplified Process</span>
                </div>
                <h2 className="text-3xl font-bold leading-tight">
                  Benefits for Both Mortgage Advisors and Banks
                </h2>
                <p className="text-xl text-muted-foreground">
                  Our platform creates value for all parties involved in the mortgage process
                </p>
                
                <div className="space-y-4 mt-8">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Time Efficiency</h3>
                      <p className="text-muted-foreground">Reduce the time spent shopping for mortgage options across multiple institutions.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="mt-1 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Perfect Matching</h3>
                      <p className="text-muted-foreground">Match clients with institutions that are actually interested in their specific case.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="mt-1 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Streamlined Communication</h3>
                      <p className="text-muted-foreground">All interactions happen in one place, with clear status updates for each request.</p>
                    </div>
                  </div>
                </div>
                
                <Button size="lg" className="mt-6" asChild>
                  <Link to="/register">Join Now <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-0 overflow-hidden shadow-lg hover-scale">
                  <div className="h-48 bg-gradient-to-br from-blue-500 to-blue-700 p-8 text-white flex flex-col justify-between">
                    <h3 className="text-2xl font-bold">For Mortgage Advisors</h3>
                    <div className="flex justify-between items-end">
                      <p className="text-white/80">Submit cases in minutes</p>
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
                <Card className="border-0 overflow-hidden shadow-lg hover-scale mt-8 sm:mt-12">
                  <div className="h-48 bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 text-white flex flex-col justify-between">
                    <h3 className="text-2xl font-bold">For Bank Representatives</h3>
                    <div className="flex justify-between items-end">
                      <p className="text-white/80">Find the perfect matches</p>
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
                <Card className="border-0 overflow-hidden shadow-lg hover-scale">
                  <div className="h-48 bg-gradient-to-br from-amber-500 to-amber-700 p-8 text-white flex flex-col justify-between">
                    <h3 className="text-2xl font-bold">Real-time Notifications</h3>
                    <div className="flex justify-between items-end">
                      <p className="text-white/80">Stay updated on all activity</p>
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
                <Card className="border-0 overflow-hidden shadow-lg hover-scale mt-8 sm:mt-12">
                  <div className="h-48 bg-gradient-to-br from-violet-500 to-violet-700 p-8 text-white flex flex-col justify-between">
                    <h3 className="text-2xl font-bold">Secure Platform</h3>
                    <div className="flex justify-between items-end">
                      <p className="text-white/80">Privacy and security built-in</p>
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
              <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Mortgage Process?</h2>
              <p className="text-xl opacity-90 mb-8">
                Join our platform today and experience a more efficient way to connect mortgage advisors with financial institutions.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="default" className="bg-white text-primary hover:bg-white/90" asChild>
                  <Link to="/register">Create Your Account</Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
                  <Link to="/login">Sign In</Link>
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
