
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MortgageCase } from '@/types';
import { Building, Landmark, Calendar, FileSymlink, Users } from 'lucide-react';

interface CaseCardProps {
  mortgageCase: MortgageCase;
  isInterested: boolean;
  onInterestToggle: () => void;
}

const CaseCard: React.FC<CaseCardProps> = ({ 
  mortgageCase, 
  isInterested, 
  onInterestToggle 
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  const getDealTypeIcon = () => {
    switch (mortgageCase.dealType) {
      case 'purchase':
        return <Landmark className="h-4 w-4 mr-1.5" />;
      case 'refinance':
        return <FileSymlink className="h-4 w-4 mr-1.5" />;
      case 'equity':
        return <Building className="h-4 w-4 mr-1.5" />;
      default:
        return <Users className="h-4 w-4 mr-1.5" />;
    }
  };

  const handleInterestToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    onInterestToggle();
    
    toast(isInterested ? 'Interest removed' : 'Interest registered', {
      description: isInterested 
        ? 'You will no longer receive updates about this case' 
        : 'You will be notified of any updates to this case',
      icon: isInterested ? '🔔' : '✅'
    });
  };

  const calculateDebtToIncomeRatio = () => {
    // Monthly income calculation (annual divided by 12)
    const monthlyIncome = mortgageCase.borrowerIncome / 12;
    // DTI ratio = monthly obligations / monthly income
    const dti = (mortgageCase.borrowerObligations / monthlyIncome) * 100;
    return dti.toFixed(1);
  };

  return (
    <div className={`border rounded-lg overflow-hidden hover-scale ${isInterested ? 'border-primary shadow-md' : ''}`}>
      <div className="p-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold">${mortgageCase.loanAmount.toLocaleString()}</h3>
            <div className="flex items-center mt-1 text-muted-foreground text-sm">
              <Calendar className="h-4 w-4 mr-1.5" />
              <span>Submitted {formatDate(mortgageCase.createdAt)}</span>
            </div>
          </div>
          <Badge className="capitalize flex items-center">
            {getDealTypeIcon()}
            {mortgageCase.dealType}
          </Badge>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Financing</p>
            <p className="font-medium">{mortgageCase.financingPercentage}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">DTI Ratio</p>
            <p className="font-medium">{calculateDebtToIncomeRatio()}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Annual Income</p>
            <p className="font-medium">${mortgageCase.borrowerIncome.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monthly Obligations</p>
            <p className="font-medium">${mortgageCase.borrowerObligations.toLocaleString()}</p>
          </div>
        </div>
        
        {mortgageCase.notes && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="text-sm mt-1">{mortgageCase.notes}</p>
          </div>
        )}
        
        <div className="mt-6 flex items-center justify-between">
          <Link to={`/bank/case/${mortgageCase.id}`}>
            <Button variant="outline" size="sm">View Details</Button>
          </Link>
          <Button 
            variant={isInterested ? "default" : "ghost"} 
            size="sm"
            onClick={handleInterestToggle}
            className={isInterested ? "" : "border"}
          >
            {isInterested ? "Interested ✓" : "Express Interest"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CaseCard;
