-- Re-process the specific invoice RIGEINV1004 to reduce stock from inventory
SELECT public.process_sales_invoice('d38b99db-bf02-4347-bdf2-7b34267b32d1'::uuid);