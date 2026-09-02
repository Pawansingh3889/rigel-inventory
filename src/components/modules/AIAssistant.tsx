import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Send, User, Lightbulb, TrendingUp, Package, DollarSign, Table as TableIcon, FileText, BarChart3 } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  tableData?: {
    columns: string[];
    rows: string[][];
  } | null;
}

const quickActions = [
  {
    icon: Package,
    title: "Inventory Management",
    description: "Check stock levels and reorder alerts",
    prompt: "Show me all products with low stock that need immediate reordering, including SKU and current quantities"
  },
  {
    icon: TrendingUp,
    title: "Sales Performance",
    description: "Analyze recent sales trends and metrics",
    prompt: "Analyze my sales performance for the last 30 days with trends and key metrics"
  },
  {
    icon: FileText,
    title: "Purchase Analytics",
    description: "Review procurement and supplier data",
    prompt: "Show me purchase invoices from the last month with supplier analysis and spending patterns"
  },
  {
    icon: DollarSign,
    title: "Financial Dashboard",
    description: "View revenue, costs, and profitability",
    prompt: "Give me a comprehensive financial overview including sales revenue, purchase costs, and profit margins"
  },
  {
    icon: BarChart3,
    title: "Business Intelligence",
    description: "Advanced analytics and KPI tracking",
    prompt: "Provide detailed business intelligence report with KPIs, trends, and performance metrics"
  },
  {
    icon: Lightbulb,
    title: "Strategic Insights",
    description: "AI-powered recommendations and opportunities",
    prompt: "Based on my complete business data, provide strategic insights, opportunities, and actionable recommendations for growth"
  }
];

export function AIAssistant() {
  const { profile } = useAuth();
  const { hasAccess } = useBusinessAuth();
  const { toast } = useToast();
  
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "🚀 Welcome to your Enhanced AI Business Assistant!\n\nI'm powered by Google Gemini and can provide comprehensive business intelligence including:\n\n📊 **Advanced Analytics**: KPIs, trends, and performance metrics\n📦 **Smart Inventory**: Stock optimization and reorder alerts\n💰 **Financial Intelligence**: Revenue analysis and cost management\n👥 **Customer Insights**: Behavior patterns and relationship analytics\n🔍 **Predictive Analytics**: Business forecasting and recommendations\n\nI understand natural language queries like:\n• \"Show top-performing products this quarter\"\n• \"Which customers have outstanding payments over 30 days?\"\n• \"Analyze supplier performance and delivery metrics\"\n• \"What are my cash flow trends?\"\n\nTry the enhanced quick actions below or ask me anything about your business!",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!hasAccess('ai')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to use the AI Assistant.</p>
        </div>
      </div>
    );
  }


  const handleSendMessage = async (message?: string) => {
    const messageText = message || inputValue.trim();
    if (!messageText || isLoading || !profile?.company_id) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('Sending message to AI assistant:', messageText);
      
      const { data, error } = await supabase.functions.invoke('gemini-business-assistant', {
        body: { 
          message: messageText,
          companyId: profile.company_id 
        }
      });

      if (error) {
        console.error('Error from AI assistant:', error);
        throw error;
      }

      console.log('AI assistant response:', data);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || "I'm sorry, I couldn't process your request right now.",
        isUser: false,
        timestamp: new Date(),
        tableData: data.tableData || null
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error calling AI assistant:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error while processing your request. Please make sure you're connected to the internet and try again.",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: 'AI Assistant Error',
        description: 'Failed to get response from AI assistant',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action, index) => (
          <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleSendMessage(action.prompt)}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <action.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">{action.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">{action.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chat Interface */}
      <Card className="h-[700px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Assistant Chat
          </CardTitle>
          <CardDescription>Ask questions about your business data and get intelligent insights with real-time analysis</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  {!message.isUser && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-lg p-3 ${
                    message.isUser 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    
                    {/* Table Data Display */}
                    {message.tableData && (
                      <div className="mt-4 border rounded-lg overflow-hidden bg-background">
                        <div className="bg-muted px-3 py-2 flex items-center gap-2">
                          <TableIcon className="h-4 w-4" />
                          <span className="text-sm font-medium text-foreground">Data Results</span>
                        </div>
                        <div className="max-h-60 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {message.tableData.columns.map((column, colIndex) => (
                                  <TableHead key={colIndex} className="text-xs font-medium">
                                    {column}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {message.tableData.rows.map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                  {row.map((cell, cellIndex) => (
                                    <TableCell key={cellIndex} className="text-xs">
                                      {cell}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                    
                    <span className="text-xs opacity-70 mt-2 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {message.isUser && (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs text-muted-foreground">AI is analyzing your data...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything: 'Monthly sales trends', 'Low stock alerts', 'Customer payment analysis', 'Supplier performance metrics'..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {!profile?.company_id && (
              <p className="text-xs text-muted-foreground mt-2">
                Please make sure you're logged in and have a company profile set up to use the AI assistant.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}