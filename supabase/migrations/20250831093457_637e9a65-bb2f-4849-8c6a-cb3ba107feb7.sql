-- Fix security warning by setting search_path for the function
CREATE OR REPLACE FUNCTION public.update_product_stock_on_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update product stock quantity based on adjustment
  IF NEW.adjustment_type = 'positive' THEN
    UPDATE public.products 
    SET stock_quantity = stock_quantity + NEW.adjustment_quantity,
        updated_at = now()
    WHERE id = NEW.product_id;
  ELSE -- negative adjustment
    UPDATE public.products 
    SET stock_quantity = stock_quantity - NEW.adjustment_quantity,
        updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';