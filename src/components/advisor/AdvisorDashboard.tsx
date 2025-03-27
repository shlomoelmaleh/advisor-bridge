
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, FileSpreadsheet, AlertCircle, Check, Clock, HandshakeIcon, LockIcon } from 'lucide-react';
import { MortgageCase, User } from '@/types';
import { getCasesByAdvisor, getCurrentUser } from '@/lib/mockData';

const getStatusColor = (status: MortgageCase['status']) => {
  switch (status) {
    case 'open':
      return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
    case 'in_progress':
      return 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20';
    case 'matched':
      return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
    case 'closed':
      return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
  }
};

const getStatusIcon = (status: MortgageCase['status']) => {
  switch (status) {
    case 'open':
      return <AlertCircle className="h-4 w-4 mr-1" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 mr-1" />;
    case 'matched':
      return <HandshakeIcon className="h-4 w-4 mr-1" />;
    case 'closed':
      return <LockIcon className="h-4 w-4 mr-1" />;
    default:
      return null;
  }
};

const getStatusLabel = (status: MortgageCase['status']) => {
  switch (status) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In Progress';
    case 'matched':
      return 'Matched';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

const AdvisorDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [cases, setCases] = useState<MortgageCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<MortgageCase[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    if (currentUser) {
      const advisorCases = getCasesByAdvisor(currentUser.id);
      setCases(advisorCases);
      setFilteredCases(advisorCases);
    }
  }, []);

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredCases(cases);
    } else {
      setFilteredCases(cases.filter(c => c.status === activeFilter));
    }
  }, [activeFilter, cases]);

  const stats = [
    {
      title: 'Total Cases',
      value: cases.length,
      icon: <FileSpreadsheet className="h-4 w-4" />,
      color: 'text-blue-500'
    },
    {
      title: 'Matched Cases',
      value: cases.filter(c => c.status === 'matched').length,
      icon: <Check className="h-4 w-4" />,
      color: 'text-green-500'
    },
    {
      title: 'Open Cases',
      value: cases.filter(c => c.status === 'open').length,
      icon: <AlertCircle className="h-4 w-4" />,
      color: 'text-amber-500'
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name}. Here's an overview of your mortgage cases.
          </p>
        </div>
        <Link to="/advisor/submit-case">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Case
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover-scale">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <div className={`rounded-full p-3 ${stat.color} bg-opacity-10`}>
                {stat.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Mortgage Cases</CardTitle>
          <CardDescription>
            Manage and track all your submitted mortgage cases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveFilter}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Cases</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="matched">Matched</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="space-y-4">
              {filteredCases.length > 0 ? (
                filteredCases.map(mortgageCase => (
                  <div 
                    key={mortgageCase.id} 
                    className="p-4 border rounded-lg hover:bg-accent transition-colors card-highlight"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <h3 className="font-semibold text-lg">
                            ${mortgageCase.loanAmount.toLocaleString()}
                          </h3>
                          <Badge 
                            className={`ml-3 flex items-center ${getStatusColor(mortgageCase.status)}`}
                          >
                            {getStatusIcon(mortgageCase.status)}
                            {getStatusLabel(mortgageCase.status)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline">{mortgageCase.dealType}</Badge>
                          <Badge variant="outline">{mortgageCase.financingPercentage}% Financing</Badge>
                          <Badge variant="outline">
                            Income: ${mortgageCase.borrowerIncome.toLocaleString()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Submitted on {formatDate(mortgageCase.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                          {mortgageCase.interestedBanks.length} interested {mortgageCase.interestedBanks.length === 1 ? 'bank' : 'banks'}
                        </span>
                        <Link to={`/advisor/case/${mortgageCase.id}`}>
                          <Button variant="outline" size="sm">View Details</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No cases found.</p>
                  <Link to="/advisor/submit-case" className="mt-4 inline-block">
                    <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Submit New Case
                    </Button>
                  </Link>
                </div>
              )}
            </TabsContent>
            <TabsContent value="open" className="space-y-4">
              {/* The filtered cases are shown automatically due to the useEffect */}
            </TabsContent>
            <TabsContent value="in_progress" className="space-y-4">
              {/* The filtered cases are shown automatically due to the useEffect */}
            </TabsContent>
            <TabsContent value="matched" className="space-y-4">
              {/* The filtered cases are shown automatically due to the useEffect */}
            </TabsContent>
            <TabsContent value="closed" className="space-y-4">
              {/* The filtered cases are shown automatically due to the useEffect */}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvisorDashboard;
