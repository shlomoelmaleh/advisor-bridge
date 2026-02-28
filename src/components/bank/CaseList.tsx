
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CaseCard from './CaseCard';

import { MortgageCase, User } from '@/types';
import { Search } from 'lucide-react';

const CaseList = () => {
  const [user, setUser] = useState<User | null>(null);
  const [cases, setCases] = useState<MortgageCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<MortgageCase[]>([]);
  const [interestedCaseIds, setInterestedCaseIds] = useState<string[]>([]);

  // Filter states
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dealTypeFilter, setDealTypeFilter] = useState('all');
  const [minLoanAmount, setMinLoanAmount] = useState(0);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    if (currentUser) {
      const availableCases = getOpenCasesForBanks();
      setCases(availableCases);

      // Initialize interested cases based on mock data
      const interested = availableCases
        .filter(c => c.interestedBanks.includes(currentUser.id))
        .map(c => c.id);

      setInterestedCaseIds(interested);
    }
  }, []);

  useEffect(() => {
    filterAndSortCases();
  }, [cases, activeTab, searchQuery, dealTypeFilter, minLoanAmount, sortBy, interestedCaseIds]);

  const filterAndSortCases = () => {
    let result = [...cases];

    // Filter by tab
    if (activeTab === 'interested') {
      result = result.filter(c => interestedCaseIds.includes(c.id));
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        c => c.notes?.toLowerCase().includes(query) ||
          c.loanAmount.toString().includes(query) ||
          c.dealType.toLowerCase().includes(query)
      );
    }

    // Filter by deal type
    if (dealTypeFilter !== 'all') {
      result = result.filter(c => c.dealType === dealTypeFilter);
    }

    // Filter by minimum loan amount
    if (minLoanAmount > 0) {
      result = result.filter(c => c.loanAmount >= minLoanAmount);
    }

    // Sort cases
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'highest':
        result.sort((a, b) => b.loanAmount - a.loanAmount);
        break;
      case 'lowest':
        result.sort((a, b) => a.loanAmount - b.loanAmount);
        break;
    }

    setFilteredCases(result);
  };

  const toggleInterest = (caseId: string) => {
    if (interestedCaseIds.includes(caseId)) {
      setInterestedCaseIds(interestedCaseIds.filter(id => id !== caseId));
    } else {
      setInterestedCaseIds([...interestedCaseIds, caseId]);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Cases</TabsTrigger>
          <TabsTrigger value="interested">Interested ({interestedCaseIds.length})</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Filters</h3>

              <div>
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by keyword"
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Deal Type</Label>
                <RadioGroup
                  value={dealTypeFilter}
                  onValueChange={setDealTypeFilter}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" />
                    <Label htmlFor="all" className="cursor-pointer">All Types</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="purchase" id="purchase" />
                    <Label htmlFor="purchase" className="cursor-pointer">Purchase</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="refinance" id="refinance" />
                    <Label htmlFor="refinance" className="cursor-pointer">Refinance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="equity" id="equity" />
                    <Label htmlFor="equity" className="cursor-pointer">Home Equity</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label htmlFor="minLoanAmount">Minimum Loan Amount</Label>
                  <span className="text-sm font-medium">{formatCurrency(minLoanAmount)}</span>
                </div>
                <Slider
                  id="minLoanAmount"
                  min={0}
                  max={1000000}
                  step={25000}
                  value={[minLoanAmount]}
                  onValueChange={(values) => setMinLoanAmount(values[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>$0</span>
                  <span>$1M+</span>
                </div>
              </div>

              <div>
                <Label htmlFor="sortBy">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sortBy" className="mt-1">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="highest">Highest Amount</SelectItem>
                    <SelectItem value="lowest">Lowest Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <TabsContent value="all" className="m-0">
              {filteredCases.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCases.map((mortgageCase) => (
                    <CaseCard
                      key={mortgageCase.id}
                      mortgageCase={mortgageCase}
                      isInterested={interestedCaseIds.includes(mortgageCase.id)}
                      onInterestToggle={() => toggleInterest(mortgageCase.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg">
                  <h3 className="text-lg font-medium">No matching cases found</h3>
                  <p className="text-muted-foreground mt-1">Try adjusting your filters</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="interested" className="m-0">
              {filteredCases.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCases.map((mortgageCase) => (
                    <CaseCard
                      key={mortgageCase.id}
                      mortgageCase={mortgageCase}
                      isInterested={interestedCaseIds.includes(mortgageCase.id)}
                      onInterestToggle={() => toggleInterest(mortgageCase.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg">
                  <h3 className="text-lg font-medium">No interested cases</h3>
                  <p className="text-muted-foreground mt-1">
                    Browse all cases and mark the ones you're interested in
                  </p>
                </div>
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
};

export default CaseList;
