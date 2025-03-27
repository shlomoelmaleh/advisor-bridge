
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Briefcase, Users, Wallet } from 'lucide-react';
import CaseList from './CaseList';
import { User } from '@/types';
import { getCurrentUser, getOpenCasesForBanks } from '@/lib/mockData';

const BankDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    totalCases: 0,
    newCases: 0,
    matchedCases: 0
  });

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    if (currentUser) {
      const cases = getOpenCasesForBanks();
      
      // Calculate stats
      setStats({
        totalCases: cases.length,
        newCases: cases.filter(c => {
          const caseDate = new Date(c.createdAt);
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          return caseDate > threeDaysAgo;
        }).length,
        matchedCases: cases.filter(c => c.interestedBanks.includes(currentUser.id)).length
      });
    }
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bank Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}. Here's an overview of available mortgage cases.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover-scale">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Available Cases</p>
              <p className="text-3xl font-bold text-primary">{stats.totalCases}</p>
            </div>
            <div className="rounded-full p-3 text-primary bg-primary/10">
              <Briefcase className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-scale">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">New (Last 3 Days)</p>
              <p className="text-3xl font-bold text-blue-500">{stats.newCases}</p>
            </div>
            <div className="rounded-full p-3 text-blue-500 bg-blue-500/10">
              <Bell className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="hover-scale">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Your Matches</p>
              <p className="text-3xl font-bold text-green-500">{stats.matchedCases}</p>
            </div>
            <div className="rounded-full p-3 text-green-500 bg-green-500/10">
              <Users className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="animate-scale-in">
        <CardHeader>
          <CardTitle>Available Mortgage Cases</CardTitle>
          <CardDescription>
            Browse through available cases and express interest in those that match your criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CaseList />
        </CardContent>
      </Card>
    </div>
  );
};

export default BankDashboard;
