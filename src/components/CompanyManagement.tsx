import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Users, Settings } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";

interface CompanyManagementProps {
  onBack: () => void;
}

export const CompanyManagement = ({ onBack }: CompanyManagementProps) => {
  const { user, availableCompanies, switchCompany } = useCompany();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    state: "",
    postalCode: "",
    country: "",
    gstin: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone || !formData.addressLine1) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      // This would call a company creation edge function
      // For now, we'll simulate success
      toast.success("Company created successfully!");
      setShowCreateForm(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        addressLine1: "",
        addressLine2: "",
        state: "",
        postalCode: "",
        country: "",
        gstin: ""
      });
    } catch (error) {
      console.error('Company creation error:', error);
      toast.error("Failed to create company");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySwitch = async (companyId: string) => {
    const success = await switchCompany(companyId);
    if (success) {
      toast.success("Switched company successfully");
    } else {
      toast.error("Failed to switch company");
    }
  };

  if (showCreateForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>
              ← Back to Companies
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Company
              </CardTitle>
              <CardDescription>
                Set up a new company profile for your business operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Company Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gstin">GSTIN</Label>
                    <Input
                      id="gstin"
                      name="gstin"
                      value={formData.gstin}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1 *</Label>
                  <Input
                    id="addressLine1"
                    name="addressLine1"
                    value={formData.addressLine1}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input
                    id="addressLine2"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleInputChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Creating..." : "Create Company"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" onClick={onBack}>
            ← Back to Sign In
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Company Management</h1>
          <p className="text-muted-foreground">
            Manage your companies and switch between different business profiles
          </p>
        </div>

        {/* Only show create button if user is an owner */}
        {user?.accessType === 'OWNER' && (
          <div className="mb-6">
            <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create New Company
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableCompanies.map((company) => (
            <Card key={company.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {company.name}
                </CardTitle>
                <CardDescription>{company.businessRefNo}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-muted-foreground">{company.email}</p>
                  <p className="text-sm text-muted-foreground">{company.phone}</p>
                  <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                    {company.status}
                  </Badge>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleCompanySwitch(company.id)}
                    className="flex-1"
                  >
                    Switch
                  </Button>
                  <Button size="sm" variant="outline">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {availableCompanies.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No companies found</p>
              {user?.accessType === 'OWNER' && (
                <p className="text-sm mt-2">Create your first company to get started</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};