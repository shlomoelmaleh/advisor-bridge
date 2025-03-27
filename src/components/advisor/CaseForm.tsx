
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

const CaseForm = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [loanAmount, setLoanAmount] = useState(300000);
  const [dealType, setDealType] = useState('purchase');
  const [financingPercentage, setFinancingPercentage] = useState(80);
  const [borrowerIncome, setBorrowerIncome] = useState(80000);
  const [borrowerObligations, setBorrowerObligations] = useState(1000);
  const [loanStructure, setLoanStructure] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate input
    if (loanAmount <= 0 || borrowerIncome <= 0) {
      toast.error('Please enter valid amounts');
      setIsSubmitting(false);
      return;
    }

    // In a real app, this would be an API call
    setTimeout(() => {
      toast.success('Case submitted successfully!');
      setIsSubmitting(false);
      navigate('/advisor/dashboard');
    }, 1000);
  };

  return (
    <Card className="max-w-3xl mx-auto animated-card">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Submit New Mortgage Case</CardTitle>
          <CardDescription>
            Complete the form below to submit a new case to bank representatives
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Loan Amount */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="loanAmount">Loan Amount</Label>
              <div className="text-right">
                <span className="text-2xl font-semibold">${loanAmount.toLocaleString()}</span>
              </div>
            </div>
            <Slider
              id="loanAmount"
              min={50000}
              max={2000000}
              step={10000}
              value={[loanAmount]}
              onValueChange={(values) => setLoanAmount(values[0])}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$50,000</span>
              <span>$2,000,000</span>
            </div>
          </div>

          {/* Deal Type */}
          <div className="space-y-2">
            <Label htmlFor="dealType">Type of Deal</Label>
            <Select 
              value={dealType} 
              onValueChange={setDealType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select deal type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="refinance">Refinance</SelectItem>
                <SelectItem value="equity">Home Equity</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Financing Percentage */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="financingPercentage">Financing Percentage</Label>
              <span className="text-lg font-medium">{financingPercentage}%</span>
            </div>
            <Slider
              id="financingPercentage"
              min={20}
              max={95}
              step={5}
              value={[financingPercentage]}
              onValueChange={(values) => setFinancingPercentage(values[0])}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>20%</span>
              <span>95%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Borrower Income */}
            <div className="space-y-2">
              <Label htmlFor="borrowerIncome">Annual Income</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="borrowerIncome"
                  type="number"
                  value={borrowerIncome}
                  onChange={(e) => setBorrowerIncome(Number(e.target.value))}
                  className="pl-7"
                  min={0}
                  required
                />
              </div>
            </div>

            {/* Borrower Obligations */}
            <div className="space-y-2">
              <Label htmlFor="borrowerObligations">Monthly Obligations</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="borrowerObligations"
                  type="number"
                  value={borrowerObligations}
                  onChange={(e) => setBorrowerObligations(Number(e.target.value))}
                  className="pl-7"
                  min={0}
                  required
                />
              </div>
            </div>
          </div>

          {/* Loan Structure */}
          <div className="space-y-2">
            <Label htmlFor="loanStructure">
              Desired Loan Structure <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <Input
              id="loanStructure"
              value={loanStructure}
              onChange={(e) => setLoanStructure(e.target.value)}
              placeholder="e.g., 30-year fixed, 5/1 ARM, etc."
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Additional Notes <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any relevant information about the borrower or property"
              rows={4}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/advisor/dashboard')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Case'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default CaseForm;
