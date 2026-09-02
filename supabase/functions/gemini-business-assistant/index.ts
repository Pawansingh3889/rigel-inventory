import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, companyId } = await req.json();

    if (!GEMINI_API_KEY) {
      throw new Error('Google Gemini API key not configured');
    }

    // Initialize Supabase client with service role for database queries
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Processing business query:', message);
    console.log('Company ID:', companyId);

    // Determine the type of query and generate appropriate SQL
    const queryAnalysis = await analyzeBusinessQuery(message);
    console.log('Query analysis:', queryAnalysis);

    let data = null;
    let queryResult = null;

    // Execute the appropriate database query based on the analysis
    if (queryAnalysis.queryType === 'sales_orders') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'sales_orders');
    } else if (queryAnalysis.queryType === 'purchase_invoices') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'purchase_invoices');
    } else if (queryAnalysis.queryType === 'customers') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'customers');
    } else if (queryAnalysis.queryType === 'suppliers') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'suppliers');
    } else if (queryAnalysis.queryType === 'products') {
      queryResult = await executeQuery(supabase, companyId, queryAnalysis, 'products');
    } else if (queryAnalysis.queryType === 'inventory') {
      queryResult = await executeInventoryQuery(supabase, companyId, queryAnalysis);
    } else if (queryAnalysis.queryType === 'payments') {
      queryResult = await executePaymentQuery(supabase, companyId, queryAnalysis);
    } else if (queryAnalysis.queryType === 'analytics') {
      queryResult = await executeAnalyticsQuery(supabase, companyId, queryAnalysis);
    } else if (queryAnalysis.queryType === 'actions') {
      queryResult = await executeActionQuery(supabase, companyId, queryAnalysis);
    } else {
      // Enhanced general business insights
      queryResult = await getEnhancedBusinessInsights(supabase, companyId);
    }

    if (queryResult.error) {
      throw new Error(`Database query failed: ${queryResult.error.message}`);
    }

    data = queryResult.data;

    // Generate AI response using Gemini
    const aiResponse = await generateGeminiResponse(message, data, queryAnalysis);

    return new Response(JSON.stringify({
      response: aiResponse,
      data: data,
      queryType: queryAnalysis.queryType,
      tableData: formatTableData(data, queryAnalysis.queryType)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gemini-business-assistant:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      response: "I'm sorry, I encountered an error while processing your request. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeBusinessQuery(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced query classification with better pattern matching
  if (lowerMessage.includes('sales order') || lowerMessage.includes('order') || 
      lowerMessage.includes('so ') || lowerMessage.includes('sale')) {
    return {
      queryType: 'sales_orders',
      timeframe: extractTimeframe(lowerMessage),
      status: extractStatus(lowerMessage),
      limit: extractLimit(lowerMessage),
      analytics: extractAnalytics(lowerMessage)
    };
  } else if (lowerMessage.includes('purchase') || lowerMessage.includes('invoice') || 
             lowerMessage.includes('pi ') || lowerMessage.includes('buy') ||
             lowerMessage.includes('procurement')) {
    return {
      queryType: 'purchase_invoices',
      timeframe: extractTimeframe(lowerMessage),
      status: extractStatus(lowerMessage),
      limit: extractLimit(lowerMessage),
      analytics: extractAnalytics(lowerMessage)
    };
  } else if (lowerMessage.includes('customer') || lowerMessage.includes('client') ||
             lowerMessage.includes('buyer')) {
    return {
      queryType: 'customers',
      limit: extractLimit(lowerMessage),
      analytics: extractAnalytics(lowerMessage)
    };
  } else if (lowerMessage.includes('supplier') || lowerMessage.includes('vendor') ||
             lowerMessage.includes('seller')) {
    return {
      queryType: 'suppliers',
      limit: extractLimit(lowerMessage),
      analytics: extractAnalytics(lowerMessage)
    };
  } else if (lowerMessage.includes('product') || lowerMessage.includes('inventory') || 
             lowerMessage.includes('stock') || lowerMessage.includes('item') ||
             lowerMessage.includes('sku')) {
    return {
      queryType: 'inventory',
      stockLevel: extractStockLevel(lowerMessage),
      limit: extractLimit(lowerMessage),
      analytics: extractAnalytics(lowerMessage)
    };
  } else if (lowerMessage.includes('payment') || lowerMessage.includes('receivable') ||
             lowerMessage.includes('payable') || lowerMessage.includes('aging') ||
             lowerMessage.includes('outstanding')) {
    return {
      queryType: 'payments',
      timeframe: extractTimeframe(lowerMessage),
      limit: extractLimit(lowerMessage),
      analytics: extractAnalytics(lowerMessage)
    };
  } else if (lowerMessage.includes('report') || lowerMessage.includes('kpi') ||
             lowerMessage.includes('metric') || lowerMessage.includes('trend') ||
             lowerMessage.includes('performance') || lowerMessage.includes('dashboard')) {
    return {
      queryType: 'analytics',
      timeframe: extractTimeframe(lowerMessage),
      limit: extractLimit(lowerMessage),
      analytics: extractAnalytics(lowerMessage)
    };
  } else if (lowerMessage.includes('email') || lowerMessage.includes('trigger') ||
             lowerMessage.includes('send') || lowerMessage.includes('notify')) {
    return {
      queryType: 'actions',
      action: extractAction(lowerMessage),
      limit: extractLimit(lowerMessage)
    };
  } else {
    return {
      queryType: 'general',
      limit: 10
    };
  }
}

function extractTimeframe(message: string) {
  if (message.includes('today') || message.includes('this day')) return 1;
  if (message.includes('yesterday')) return 1;
  if (message.includes('last week') || message.includes('7 days') || message.includes('this week')) return 7;
  if (message.includes('last month') || message.includes('30 days') || message.includes('this month')) return 30;
  if (message.includes('last 15 days') || message.includes('15 days') || message.includes('half month')) return 15;
  if (message.includes('last 3 months') || message.includes('90 days') || message.includes('quarter')) return 90;
  if (message.includes('last 6 months') || message.includes('180 days') || message.includes('half year')) return 180;
  if (message.includes('last year') || message.includes('365 days') || message.includes('12 months')) return 365;
  
  // Extract custom number of days
  const dayMatch = message.match(/(\d+)\s*days?/);
  if (dayMatch) return Math.min(parseInt(dayMatch[1]), 365);
  
  return null;
}

function extractStatus(message: string) {
  if (message.includes('pending') || message.includes('waiting')) return 'pending';
  if (message.includes('completed') || message.includes('finished') || message.includes('done')) return 'completed';
  if (message.includes('draft') || message.includes('unpublished')) return 'draft';
  if (message.includes('invoiced') || message.includes('billed')) return 'invoiced';
  if (message.includes('received') || message.includes('delivered')) return 'received';
  if (message.includes('cancelled') || message.includes('canceled')) return 'cancelled';
  return null;
}

function extractStockLevel(message: string) {
  if (message.includes('low stock') || message.includes('reorder') || message.includes('minimum')) return 'low';
  if (message.includes('out of stock') || message.includes('zero stock') || message.includes('empty')) return 'out';
  if (message.includes('high stock') || message.includes('excess') || message.includes('overstocked')) return 'high';
  return null;
}

function extractAnalytics(message: string) {
  const analytics = [];
  if (message.includes('total') || message.includes('sum') || message.includes('amount')) analytics.push('total');
  if (message.includes('average') || message.includes('avg') || message.includes('mean')) analytics.push('average');
  if (message.includes('count') || message.includes('number') || message.includes('quantity')) analytics.push('count');
  if (message.includes('trend') || message.includes('growth') || message.includes('change')) analytics.push('trend');
  if (message.includes('top') || message.includes('best') || message.includes('highest')) analytics.push('top');
  if (message.includes('bottom') || message.includes('worst') || message.includes('lowest')) analytics.push('bottom');
  return analytics.length > 0 ? analytics : null;
}

function extractAction(message: string) {
  if (message.includes('email') || message.includes('send mail')) return 'email';
  if (message.includes('notify') || message.includes('alert')) return 'notify';
  if (message.includes('trigger') || message.includes('execute')) return 'trigger';
  return null;
}

function extractLimit(message: string) {
  const match = message.match(/(\d+)/);
  return match ? Math.min(parseInt(match[1]), 100) : 15; // Increased default and max
}

async function executeQuery(supabase: any, companyId: string, analysis: any, table: string) {
  let query = supabase.from(table).select('*').eq('company_id', companyId);

  // Apply timeframe filter
  if (analysis.timeframe) {
    const dateField = table === 'sales_orders' ? 'order_date' : 
                     table === 'purchase_invoices' ? 'purchase_invoice_date' : 'created_at';
    const date = new Date();
    date.setDate(date.getDate() - analysis.timeframe);
    query = query.gte(dateField, date.toISOString().split('T')[0]);
  }

  // Apply status filter
  if (analysis.status) {
    query = query.eq('status', analysis.status);
  }

  // Apply limit and order
  query = query.order('created_at', { ascending: false }).limit(analysis.limit || 10);

  return await query;
}

async function executeInventoryQuery(supabase: any, companyId: string, analysis: any) {
  let query = supabase.from('products').select('*').eq('company_id', companyId);

  if (analysis.stockLevel === 'low') {
    // Use a raw query to properly compare numeric columns
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .filter('stock_quantity', 'lte', 'min_stock_level')
      .order('stock_quantity', { ascending: true })
      .limit(analysis.limit || 15);
    
    // If the filter doesn't work, fallback to manual filtering
    if (error || !data) {
      const allProducts = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .order('stock_quantity', { ascending: true });
      
      if (allProducts.data) {
        const lowStockProducts = allProducts.data.filter(product => 
          product.stock_quantity <= product.min_stock_level
        ).slice(0, analysis.limit || 15);
        
        return { data: lowStockProducts, error: null };
      }
    }
    
    return { data, error };
  } else if (analysis.stockLevel === 'out') {
    query = query.eq('stock_quantity', 0);
  } else if (analysis.stockLevel === 'high') {
    // Products where stock is significantly higher than min level
    const allProducts = await supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId);
    
    if (allProducts.data) {
      const highStockProducts = allProducts.data.filter(product => 
        product.stock_quantity >= (product.min_stock_level * 3)
      ).slice(0, analysis.limit || 15);
      
      return { data: highStockProducts, error: null };
    }
  }

  query = query.order('stock_quantity', { ascending: true }).limit(analysis.limit || 15);
  return await query;
}

async function executePaymentQuery(supabase: any, companyId: string, analysis: any) {
  let query = supabase.from('payments').select('*').eq('company_id', companyId);
  
  if (analysis.timeframe) {
    const date = new Date();
    date.setDate(date.getDate() - analysis.timeframe);
    query = query.gte('payment_date', date.toISOString().split('T')[0]);
  }
  
  query = query.order('payment_date', { ascending: false }).limit(analysis.limit || 15);
  return await query;
}

async function executeAnalyticsQuery(supabase: any, companyId: string, analysis: any) {
  // Get comprehensive analytics data
  const [salesStats, purchaseStats, customerStats, productStats] = await Promise.all([
    supabase.from('sales_orders').select('total_amount, status, order_date').eq('company_id', companyId),
    supabase.from('purchase_invoices').select('total_amount, status, purchase_invoice_date').eq('company_id', companyId),
    supabase.from('customers').select('id, name, is_active').eq('company_id', companyId),
    supabase.from('products').select('stock_quantity, unit_price, cost_price').eq('company_id', companyId)
  ]);

  return {
    data: {
      sales_analytics: salesStats.data || [],
      purchase_analytics: purchaseStats.data || [],
      customer_analytics: customerStats.data || [],
      product_analytics: productStats.data || []
    },
    error: null
  };
}

async function executeActionQuery(supabase: any, companyId: string, analysis: any) {
  // Handle action-based queries (like email triggers)
  return {
    data: {
      action: analysis.action,
      message: "Action queries are informational only. I can provide guidance on implementing automated workflows."
    },
    error: null
  };
}

async function getEnhancedBusinessInsights(supabase: any, companyId: string) {
  // Get comprehensive business data with analytics
  const [salesResult, purchaseResult, customerResult, productResult, paymentResult] = await Promise.all([
    supabase.from('sales_orders').select('id, total_amount, status, order_date').eq('company_id', companyId).order('order_date', { ascending: false }).limit(10),
    supabase.from('purchase_invoices').select('id, total_amount, status, purchase_invoice_date').eq('company_id', companyId).order('purchase_invoice_date', { ascending: false }).limit(10),
    supabase.from('customers').select('id, name, is_active, credit_limit').eq('company_id', companyId).limit(10),
    supabase.from('products').select('id, name, stock_quantity, min_stock_level, unit_price').eq('company_id', companyId).limit(10),
    supabase.from('payments').select('id, amount, payment_date, payment_method').eq('company_id', companyId).order('payment_date', { ascending: false }).limit(5)
  ]);

  // Calculate basic analytics
  const salesData = salesResult.data || [];
  const purchaseData = purchaseResult.data || [];
  const productData = productResult.data || [];
  
  const totalSales = salesData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const totalPurchases = purchaseData.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);
  const lowStockCount = productData.filter(product => product.stock_quantity <= product.min_stock_level).length;

  return {
    data: {
      sales_orders: salesData,
      purchase_invoices: purchaseData,
      customers: customerResult.data || [],
      products: productData,
      payments: paymentResult.data || [],
      analytics: {
        total_sales: totalSales,
        total_purchases: totalPurchases,
        low_stock_items: lowStockCount,
        active_customers: (customerResult.data || []).filter(c => c.is_active).length
      }
    },
    error: null
  };
}

async function generateGeminiResponse(message: string, data: any, analysis: any) {
  // Enhanced business context for better AI responses
  const businessContext = `You are an expert business intelligence assistant specialized in ERP and business management. 
  You help business owners and managers understand their data, identify trends, and make informed decisions.
  
  Your expertise includes:
  - Sales order management and analysis
  - Purchase order and invoice tracking
  - Inventory management and stock optimization
  - Customer relationship insights
  - Supplier performance evaluation
  - Financial analytics and cash flow
  - Business performance metrics and KPIs
  
  Always provide:
  1. Direct, actionable answers
  2. Data-driven insights
  3. Business recommendations
  4. Industry best practices where relevant
  5. Specific metrics and trends when available`;

  let enhancedPrompt = `${businessContext}
  
  User Question: "${message}"
  Query Type: ${analysis.queryType}
  
  Business Data Analysis:
  ${JSON.stringify(data, null, 2)}
  
  Please provide a comprehensive business intelligence response that includes:
  
  1. **Direct Answer**: Address the specific question asked
  2. **Key Insights**: Highlight important patterns, trends, or metrics from the data
  3. **Business Impact**: Explain what this means for the business
  4. **Actionable Recommendations**: Suggest specific next steps or improvements
  5. **Industry Context**: Add relevant business best practices if applicable
  
  Format your response to be professional, insightful, and actionable for business decision-making.`;

  // Add specific context based on query type
  if (analysis.queryType === 'inventory' && analysis.stockLevel === 'low') {
    enhancedPrompt += `\n\nNote: Focus on inventory management best practices, reorder points, and supply chain optimization.`;
  } else if (analysis.queryType === 'sales_orders') {
    enhancedPrompt += `\n\nNote: Include sales performance analysis, customer trends, and revenue insights.`;
  } else if (analysis.queryType === 'analytics') {
    enhancedPrompt += `\n\nNote: Provide comprehensive KPI analysis, trend identification, and performance benchmarking.`;
  } else if (analysis.queryType === 'actions') {
    enhancedPrompt += `\n\nNote: Provide guidance on business process automation and workflow optimization.`;
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: enhancedPrompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.3,
        topP: 0.8,
        topK: 40
      }
    }),
  });

  const result = await response.json();
  console.log('Gemini API response:', result);
  
  if (result.candidates && result.candidates[0] && result.candidates[0].content) {
    return result.candidates[0].content.parts[0].text;
  } else {
    throw new Error('Invalid response from Gemini API');
  }
}

function formatTableData(data: any, queryType: string) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  // Handle enhanced general insights data
  if (queryType === 'general' && data.sales_orders) {
    const analytics = data.analytics || {};
    return {
      columns: ['Metric', 'Value', 'Details', 'Status'],
      rows: [
        ['Total Sales', `₹${analytics.total_sales?.toLocaleString() || '0'}`, `${data.sales_orders.length} orders`, 'Active'],
        ['Total Purchases', `₹${analytics.total_purchases?.toLocaleString() || '0'}`, `${data.purchase_invoices.length} invoices`, 'Active'],
        ['Active Customers', analytics.active_customers || '0', `${data.customers.length} total`, 'Engaged'],
        ['Low Stock Items', analytics.low_stock_items || '0', `${data.products.length} total products`, analytics.low_stock_items > 0 ? 'Alert' : 'Good'],
        ['Recent Payments', data.payments.length || '0', 'Last 5 transactions', 'Processing']
      ]
    };
  }

  // Handle analytics data
  if (queryType === 'analytics') {
    const salesData = data.sales_analytics || [];
    const purchaseData = data.purchase_analytics || [];
    const customerData = data.customer_analytics || [];
    const productData = data.product_analytics || [];
    
    const totalSalesRevenue = salesData.reduce((sum: number, item: any) => sum + (item.total_amount || 0), 0);
    const totalPurchaseCost = purchaseData.reduce((sum: number, item: any) => sum + (item.total_amount || 0), 0);
    const grossMargin = totalSalesRevenue - totalPurchaseCost;
    const avgOrderValue = salesData.length > 0 ? totalSalesRevenue / salesData.length : 0;

    return {
      columns: ['KPI', 'Value', 'Count', 'Performance'],
      rows: [
        ['Sales Revenue', `₹${totalSalesRevenue.toLocaleString()}`, `${salesData.length} orders`, 'Strong'],
        ['Purchase Cost', `₹${totalPurchaseCost.toLocaleString()}`, `${purchaseData.length} invoices`, 'Managed'],
        ['Gross Margin', `₹${grossMargin.toLocaleString()}`, 'Revenue - Cost', grossMargin > 0 ? 'Positive' : 'Negative'],
        ['Avg Order Value', `₹${avgOrderValue.toLocaleString()}`, 'Per transaction', 'Metric'],
        ['Active Customers', customerData.filter((c: any) => c.is_active).length.toString(), `${customerData.length} total`, 'Engaged']
      ]
    };
  }

  // Handle payment data
  if (queryType === 'payments') {
    return {
      columns: ['Payment ID', 'Amount', 'Date', 'Method', 'Status'],
      rows: data.map((item: any) => [
        `PAY-${item.id.slice(-6)}`,
        `₹${item.amount?.toLocaleString() || '0'}`,
        new Date(item.payment_date).toLocaleDateString(),
        item.payment_method || 'N/A',
        'Processed'
      ])
    };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  // Enhanced formatting based on query type
  switch (queryType) {
    case 'sales_orders':
      return {
        columns: ['Order #', 'Customer', 'Date', 'Amount', 'Status'],
        rows: data.map((item: any) => [
          item.order_number || 'N/A',
          item.customer_name || 'N/A',
          new Date(item.order_date).toLocaleDateString(),
          `₹${item.total_amount?.toLocaleString() || '0'}`,
          item.status || 'N/A'
        ])
      };

    case 'purchase_invoices':
      return {
        columns: ['Invoice #', 'Supplier', 'Date', 'Amount', 'Status'],
        rows: data.map((item: any) => [
          item.purchase_invoice_number || 'N/A',
          item.supplier_id || 'N/A',
          new Date(item.purchase_invoice_date).toLocaleDateString(),
          `₹${item.total_amount?.toLocaleString() || '0'}`,
          item.status || 'N/A'
        ])
      };

    case 'customers':
      return {
        columns: ['Name', 'Email', 'Phone', 'Credit Limit', 'Status'],
        rows: data.map((item: any) => [
          item.name || 'N/A',
          item.email || 'N/A',
          item.phone || 'N/A',
          item.credit_limit ? `₹${item.credit_limit.toLocaleString()}` : 'N/A',
          item.is_active ? 'Active' : 'Inactive'
        ])
      };

    case 'suppliers':
      return {
        columns: ['Name', 'Contact Person', 'Email', 'Phone', 'GST'],
        rows: data.map((item: any) => [
          item.name || 'N/A',
          item.contact_person || 'N/A',
          item.email || 'N/A',
          item.phone || 'N/A',
          item.gst_number || 'N/A'
        ])
      };

    case 'inventory':
      return {
        columns: ['Product Name', 'SKU', 'Current Stock', 'Min Level', 'Unit Price', 'Status'],
        rows: data.map((item: any) => {
          const stockStatus = item.stock_quantity <= item.min_stock_level ? 'Low Stock' : 
                             item.stock_quantity === 0 ? 'Out of Stock' : 'In Stock';
          return [
            item.name || 'N/A',
            item.sku || 'N/A',
            item.stock_quantity?.toString() || '0',
            item.min_stock_level?.toString() || '0',
            `₹${item.unit_price?.toLocaleString() || '0'}`,
            stockStatus
          ];
        })
      };

    case 'actions':
      return {
        columns: ['Action Type', 'Description', 'Implementation', 'Notes'],
        rows: [
          [data.action || 'General', 'Business Process Automation', 'Custom Development', data.message || 'Contact support for implementation']
        ]
      };

    default:
      return null;
  }
}