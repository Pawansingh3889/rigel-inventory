import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CompanyAuthProps {
  onSuccess: (data: any) => void;
}

export const CompanyAuth = ({ onSuccess }: CompanyAuthProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessRefNo: "",
    username: "",
    password: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.businessRefNo || !formData.username || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('signin', {
        body: {
          businessRefNo: formData.businessRefNo,
          username: formData.username,
          password: formData.password
        }
      });

      if (error) {
        console.error('Signin error:', error);
        toast.error("Sign in failed. Please try again.");
        return;
      }

      if (!data.success) {
        toast.error(data.error || "Invalid credentials");
        return;
      }

      toast.success("Sign in successful!");
      onSuccess(data);
      
    } catch (error) {
      console.error('Signin error:', error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Company Sign In</CardTitle>
          <CardDescription className="text-center">
            Sign in to your company account using your business credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessRefNo">Business Reference Number</Label>
              <Input
                id="businessRefNo"
                name="businessRefNo"
                type="text"
                placeholder="Enter your business reference number"
                value={formData.businessRefNo}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};