export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      auth_rate_limits: {
        Row: {
          attempt_count: number
          blocked_until: string | null
          created_at: string
          email: string | null
          id: string
          ip_address: unknown
          last_attempt: string
        }
        Insert: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address: unknown
          last_attempt?: string
        }
        Update: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: unknown
          last_attempt?: string
        }
        Relationships: []
      }
      bom_components: {
        Row: {
          bom_id: string
          component_product_id: string
          created_at: string
          id: string
          quantity_per_unit: number
          unit_cost: number
        }
        Insert: {
          bom_id: string
          component_product_id: string
          created_at?: string
          id?: string
          quantity_per_unit: number
          unit_cost?: number
        }
        Update: {
          bom_id?: string
          component_product_id?: string
          created_at?: string
          id?: string
          quantity_per_unit?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_components_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_headers: {
        Row: {
          bin_id: string | null
          bom_name: string
          company_id: string
          created_at: string
          created_by: string
          finished_product_id: string
          id: string
          is_active: boolean
          labor_cost_per_unit: number
          material_cost_per_unit: number
          notes: string | null
          overhead_cost_per_unit: number
          production_ready: boolean
          total_cost_per_unit: number
          updated_at: string
          version: string
          warehouse_id: string | null
          yield_quantity: number
        }
        Insert: {
          bin_id?: string | null
          bom_name: string
          company_id: string
          created_at?: string
          created_by?: string
          finished_product_id: string
          id?: string
          is_active?: boolean
          labor_cost_per_unit?: number
          material_cost_per_unit?: number
          notes?: string | null
          overhead_cost_per_unit?: number
          production_ready?: boolean
          total_cost_per_unit?: number
          updated_at?: string
          version?: string
          warehouse_id?: string | null
          yield_quantity?: number
        }
        Update: {
          bin_id?: string | null
          bom_name?: string
          company_id?: string
          created_at?: string
          created_by?: string
          finished_product_id?: string
          id?: string
          is_active?: boolean
          labor_cost_per_unit?: number
          material_cost_per_unit?: number
          notes?: string | null
          overhead_cost_per_unit?: number
          production_ready?: boolean
          total_cost_per_unit?: number
          updated_at?: string
          version?: string
          warehouse_id?: string | null
          yield_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_headers_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          address_line1: string | null
          address_line2: string | null
          business_ref_no: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          gstn: string | null
          id: string
          name: string
          phone: string | null
          postal_code: string | null
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          business_ref_no?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gstn?: string | null
          id?: string
          name: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          business_ref_no?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gstn?: string | null
          id?: string
          name?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_user_section_permissions: {
        Row: {
          access_sections: Json
          company_id: string
          created_at: string
          id: string
          updated_at: string
          user_email: string
        }
        Insert: {
          access_sections?: Json
          company_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_email: string
        }
        Update: {
          access_sections?: Json
          company_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_email?: string
        }
        Relationships: []
      }
      company_users: {
        Row: {
          access_type: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string | null
          id: string
          password_hash: string
          status: string | null
          updated_at: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          access_type?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name?: string | null
          id?: string
          password_hash: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          access_type?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          password_hash?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_items: {
        Row: {
          bin_id: string | null
          cgst_amount: number | null
          cgst_rate: number | null
          created_at: string
          credit_note_id: string
          discount_amount: number
          discount_percentage: number | null
          hsn_sac_code: string | null
          id: string
          igst_amount: number | null
          igst_rate: number | null
          line_subtotal: number
          line_total: number
          pending_return_qty: number
          product_id: string
          product_name: string
          product_sku: string
          return_qty: number
          rso_qty: number
          sgst_amount: number | null
          sgst_rate: number | null
          tax_amount: number
          unit_of_measure: string
          unit_price: number
          warehouse_id: string
        }
        Insert: {
          bin_id?: string | null
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          credit_note_id: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          line_subtotal?: number
          line_total?: number
          pending_return_qty?: number
          product_id: string
          product_name: string
          product_sku: string
          return_qty?: number
          rso_qty: number
          sgst_amount?: number | null
          sgst_rate?: number | null
          tax_amount?: number
          unit_of_measure?: string
          unit_price?: number
          warehouse_id: string
        }
        Update: {
          bin_id?: string | null
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          credit_note_id?: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          line_subtotal?: number
          line_total?: number
          pending_return_qty?: number
          product_id?: string
          product_name?: string
          product_sku?: string
          return_qty?: number
          rso_qty?: number
          sgst_amount?: number | null
          sgst_rate?: number | null
          tax_amount?: number
          unit_of_measure?: string
          unit_price?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_credit_note_items_bin"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_note_items_credit_note"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_note_items_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_note_items_warehouse"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount_in_words: string | null
          cn_date: string
          cn_number: string | null
          company_id: string
          created_at: string
          created_by: string
          customer_id: string
          customer_name: string
          default_warehouse_id: string
          discount_amount: number
          id: string
          notes: string | null
          rso_id: string
          status: string
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_in_words?: string | null
          cn_date?: string
          cn_number?: string | null
          company_id: string
          created_at?: string
          created_by: string
          customer_id: string
          customer_name: string
          default_warehouse_id: string
          discount_amount?: number
          id?: string
          notes?: string | null
          rso_id: string
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_in_words?: string | null
          cn_date?: string
          cn_number?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          customer_name?: string
          default_warehouse_id?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          rso_id?: string
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_credit_notes_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_notes_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_notes_rso"
            columns: ["rso_id"]
            isOneToOne: false
            referencedRelation: "return_order_header"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_notes_warehouse"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_number: string | null
          account_type: string | null
          address: string | null
          address_line1: string | null
          address_line2: string | null
          alternate_email: string | null
          bank_name: string | null
          billing_cycle: string | null
          branch_name: string | null
          business_registration_no: string | null
          city: string | null
          company_id: string
          contact_person: string | null
          country: string | null
          created_at: string
          credit_limit: number | null
          credit_limit_days: number | null
          customer_ref: string | null
          customer_type: string | null
          email: string | null
          gst_tax_location: string | null
          gstin: string | null
          id: string
          ifsc_code: string | null
          is_active: boolean
          landline_number: string | null
          msme_registration_no: string | null
          name: string
          pan_number: string | null
          payment_terms: string | null
          phone: string | null
          pin_code: string | null
          preferred_currency: string | null
          preferred_payment_method: string | null
          same_as_registered_address: boolean | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_pin_code: string | null
          shipping_state: string | null
          state: string | null
          swift_code: string | null
          updated_at: string
          upi_id: string | null
          website: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          alternate_email?: string | null
          bank_name?: string | null
          billing_cycle?: string | null
          branch_name?: string | null
          business_registration_no?: string | null
          city?: string | null
          company_id: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_limit_days?: number | null
          customer_ref?: string | null
          customer_type?: string | null
          email?: string | null
          gst_tax_location?: string | null
          gstin?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          landline_number?: string | null
          msme_registration_no?: string | null
          name: string
          pan_number?: string | null
          payment_terms?: string | null
          phone?: string | null
          pin_code?: string | null
          preferred_currency?: string | null
          preferred_payment_method?: string | null
          same_as_registered_address?: boolean | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_pin_code?: string | null
          shipping_state?: string | null
          state?: string | null
          swift_code?: string | null
          updated_at?: string
          upi_id?: string | null
          website?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          alternate_email?: string | null
          bank_name?: string | null
          billing_cycle?: string | null
          branch_name?: string | null
          business_registration_no?: string | null
          city?: string | null
          company_id?: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_limit_days?: number | null
          customer_ref?: string | null
          customer_type?: string | null
          email?: string | null
          gst_tax_location?: string | null
          gstin?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          landline_number?: string | null
          msme_registration_no?: string | null
          name?: string
          pan_number?: string | null
          payment_terms?: string | null
          phone?: string | null
          pin_code?: string | null
          preferred_currency?: string | null
          preferred_payment_method?: string | null
          same_as_registered_address?: boolean | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_pin_code?: string | null
          shipping_state?: string | null
          state?: string | null
          swift_code?: string | null
          updated_at?: string
          upi_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_confirmations: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          purpose?: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          token_hash?: string
        }
        Relationships: []
      }
      email_otps: {
        Row: {
          attempt_count: number | null
          consumed_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          otp_hash: string
        }
        Insert: {
          attempt_count?: number | null
          consumed_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          otp_hash: string
        }
        Update: {
          attempt_count?: number | null
          consumed_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
        }
        Relationships: []
      }
      grn_header: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          grn_date: string
          grn_number: string
          grn_reference_no: string | null
          id: string
          purchase_order_id: string
          remarks: string | null
          status: string
          subtotal_amount: number
          supplier_id: string
          supplier_invoice_date: string | null
          supplier_invoice_number: string | null
          supplier_name: string
          total_accepted_quantity: number
          total_amount: number
          total_discount_amount: number
          total_ordered_quantity: number
          total_received_quantity: number
          total_rejected_quantity: number
          total_tax_amount: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          grn_date?: string
          grn_number: string
          grn_reference_no?: string | null
          id?: string
          purchase_order_id: string
          remarks?: string | null
          status?: string
          subtotal_amount?: number
          supplier_id: string
          supplier_invoice_date?: string | null
          supplier_invoice_number?: string | null
          supplier_name: string
          total_accepted_quantity?: number
          total_amount?: number
          total_discount_amount?: number
          total_ordered_quantity?: number
          total_received_quantity?: number
          total_rejected_quantity?: number
          total_tax_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          grn_date?: string
          grn_number?: string
          grn_reference_no?: string | null
          id?: string
          purchase_order_id?: string
          remarks?: string | null
          status?: string
          subtotal_amount?: number
          supplier_id?: string
          supplier_invoice_date?: string | null
          supplier_invoice_number?: string | null
          supplier_name?: string
          total_accepted_quantity?: number
          total_amount?: number
          total_discount_amount?: number
          total_ordered_quantity?: number
          total_received_quantity?: number
          total_rejected_quantity?: number
          total_tax_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      grn_line_items: {
        Row: {
          accepted_quantity: number
          bin_id: string | null
          cgst_amount: number | null
          cgst_rate: number | null
          created_at: string
          discount_amount: number | null
          discount_percentage: number | null
          grn_header_id: string
          hsn_sac_code: string | null
          id: string
          igst_amount: number | null
          igst_rate: number | null
          line_total: number
          ordered_quantity: number
          product_id: string
          product_name: string
          product_sku: string
          received_quantity: number
          rejected_quantity: number
          sgst_amount: number | null
          sgst_rate: number | null
          total_tax_amount: number | null
          unit_of_measure: string
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          accepted_quantity?: number
          bin_id?: string | null
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          grn_header_id: string
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          line_total?: number
          ordered_quantity: number
          product_id: string
          product_name: string
          product_sku: string
          received_quantity?: number
          rejected_quantity?: number
          sgst_amount?: number | null
          sgst_rate?: number | null
          total_tax_amount?: number | null
          unit_of_measure?: string
          unit_price?: number
          warehouse_id?: string | null
        }
        Update: {
          accepted_quantity?: number
          bin_id?: string | null
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          grn_header_id?: string
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          line_total?: number
          ordered_quantity?: number
          product_id?: string
          product_name?: string
          product_sku?: string
          received_quantity?: number
          rejected_quantity?: number
          sgst_amount?: number | null
          sgst_rate?: number | null
          total_tax_amount?: number | null
          unit_of_measure?: string
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_line_items_grn_header_id_fkey"
            columns: ["grn_header_id"]
            isOneToOne: false
            referencedRelation: "grn_header"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_processing_log: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          grn_id: string
          grn_number: string
          id: string
          items_processed: number | null
          processing_status: string
          transactions_created: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          grn_id: string
          grn_number: string
          id?: string
          items_processed?: number | null
          processing_status: string
          transactions_created?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          grn_id?: string
          grn_number?: string
          id?: string
          items_processed?: number | null
          processing_status?: string
          transactions_created?: number | null
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          adjustment_amount: number | null
          adjustment_quantity: number
          adjustment_type: string
          company_id: string
          created_at: string
          created_by: string
          current_stock_after: number
          current_stock_before: number
          id: string
          product_id: string
          reason: string
          remarks: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          adjustment_amount?: number | null
          adjustment_quantity: number
          adjustment_type: string
          company_id: string
          created_at?: string
          created_by: string
          current_stock_after?: number
          current_stock_before?: number
          id?: string
          product_id: string
          reason: string
          remarks?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          adjustment_amount?: number | null
          adjustment_quantity?: number
          adjustment_type?: string
          company_id?: string
          created_at?: string
          created_by?: string
          current_stock_after?: number
          current_stock_before?: number
          id?: string
          product_id?: string
          reason?: string
          remarks?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          bin_id: string | null
          company_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          product_id: string
          quantity_change: number
          reference_id: string | null
          reference_number: string | null
          total_value: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_cost: number | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          bin_id?: string | null
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          product_id: string
          quantity_change: number
          reference_id?: string | null
          reference_number?: string | null
          total_value?: number | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_cost?: number | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          bin_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity_change?: number
          reference_id?: string | null
          reference_number?: string | null
          total_value?: number | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          unit_cost?: number | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_transactions_bin_id"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inventory_transactions_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_inventory_transactions_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inventory_transactions_warehouse_id"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      password_resets: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string
          grn_id: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_status: string | null
          payment_type: string | null
          purchase_order_id: string | null
          reference_number: string | null
          sales_invoice_id: string | null
          sales_order_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by: string
          grn_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          payment_status?: string | null
          payment_type?: string | null
          purchase_order_id?: string | null
          reference_number?: string | null
          sales_invoice_id?: string | null
          sales_order_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string
          grn_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_status?: string | null
          payment_type?: string | null
          purchase_order_id?: string | null
          reference_number?: string | null
          sales_invoice_id?: string | null
          sales_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grn_header"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      performa_invoice_items: {
        Row: {
          cgst_amount: number | null
          cgst_rate: number | null
          created_at: string
          discount_amount: number
          discount_percentage: number | null
          hsn_sac_code: string | null
          id: string
          igst_amount: number | null
          igst_rate: number | null
          item_description: string
          performa_invoice_id: string
          product_id: string
          quantity: number
          sgst_amount: number | null
          sgst_rate: number | null
          tax_percentage: number | null
          total_price: number
          unit_of_measure: string
          unit_price: number
        }
        Insert: {
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          item_description?: string
          performa_invoice_id: string
          product_id: string
          quantity: number
          sgst_amount?: number | null
          sgst_rate?: number | null
          tax_percentage?: number | null
          total_price: number
          unit_of_measure?: string
          unit_price: number
        }
        Update: {
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          item_description?: string
          performa_invoice_id?: string
          product_id?: string
          quantity?: number
          sgst_amount?: number | null
          sgst_rate?: number | null
          tax_percentage?: number | null
          total_price?: number
          unit_of_measure?: string
          unit_price?: number
        }
        Relationships: []
      }
      performa_invoices: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          customer_id: string
          customer_name: string
          discount_amount: number
          id: string
          notes: string | null
          performa_invoice_date: string
          performa_invoice_number: string | null
          place_of_supply: string | null
          sales_order_id: string
          status: string
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          customer_id: string
          customer_name: string
          discount_amount?: number
          id?: string
          notes?: string | null
          performa_invoice_date?: string
          performa_invoice_number?: string | null
          place_of_supply?: string | null
          sales_order_id: string
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          customer_name?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          performa_invoice_date?: string
          performa_invoice_number?: string | null
          place_of_supply?: string | null
          sales_order_id?: string
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_runs: {
        Row: {
          bin_id: string | null
          bom_id: string
          company_id: string
          created_at: string
          created_by: string
          finished_product_id: string
          id: string
          labor_cost_total: number
          material_cost_total: number
          overhead_cost_total: number
          quantity_produced: number
          total_cost: number
          warehouse_id: string
        }
        Insert: {
          bin_id?: string | null
          bom_id: string
          company_id: string
          created_at?: string
          created_by?: string
          finished_product_id: string
          id?: string
          labor_cost_total?: number
          material_cost_total?: number
          overhead_cost_total?: number
          quantity_produced: number
          total_cost?: number
          warehouse_id: string
        }
        Update: {
          bin_id?: string | null
          bom_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          finished_product_id?: string
          id?: string
          labor_cost_total?: number
          material_cost_total?: number
          overhead_cost_total?: number
          quantity_produced?: number
          total_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_runs_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_finished_product_id_fkey"
            columns: ["finished_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          bin_name: string | null
          category_id: string | null
          company_id: string
          cost_price: number
          created_at: string
          description: string | null
          gst_percentage: number | null
          height_cm: number | null
          hsn_code: string | null
          id: string
          is_active: boolean
          is_taxable: boolean | null
          length_cm: number | null
          max_stock_level: number | null
          min_stock_level: number
          mrp: number | null
          name: string
          product_category: string | null
          product_type: string | null
          sku: string
          stock_quantity: number
          unit: string | null
          unit_price: number
          updated_at: string
          volume_cubic_cm: number | null
          weight_kg: number | null
          wh_bin_code: string | null
          width_cm: number | null
        }
        Insert: {
          barcode?: string | null
          bin_name?: string | null
          category_id?: string | null
          company_id: string
          cost_price?: number
          created_at?: string
          description?: string | null
          gst_percentage?: number | null
          height_cm?: number | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          is_taxable?: boolean | null
          length_cm?: number | null
          max_stock_level?: number | null
          min_stock_level?: number
          mrp?: number | null
          name: string
          product_category?: string | null
          product_type?: string | null
          sku: string
          stock_quantity?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          volume_cubic_cm?: number | null
          weight_kg?: number | null
          wh_bin_code?: string | null
          width_cm?: number | null
        }
        Update: {
          barcode?: string | null
          bin_name?: string | null
          category_id?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          gst_percentage?: number | null
          height_cm?: number | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          is_taxable?: boolean | null
          length_cm?: number | null
          max_stock_level?: number | null
          min_stock_level?: number
          mrp?: number | null
          name?: string
          product_category?: string | null
          product_type?: string | null
          sku?: string
          stock_quantity?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          volume_cubic_cm?: number | null
          weight_kg?: number | null
          wh_bin_code?: string | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          otp_code: string | null
          otp_expires_at: string | null
          phone: string | null
          phone_verified: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          otp_code?: string | null
          otp_expires_at?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          otp_code?: string | null
          otp_expires_at?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          cgst_amount: number | null
          cgst_rate: number | null
          created_at: string
          discount_amount: number | null
          discount_percentage: number | null
          gst_rate: number | null
          hsn_sac_code: string | null
          id: string
          igst_amount: number | null
          igst_rate: number | null
          is_taxable: boolean | null
          item_code: string | null
          item_description: string
          pending_quantity: number | null
          product_id: string | null
          purchase_order_id: string
          quantity: number
          received_quantity: number
          remarks: string | null
          sgst_amount: number | null
          sgst_rate: number | null
          taxable_value: number | null
          total_price: number
          unit_of_measure: string
          unit_price: number
        }
        Insert: {
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          gst_rate?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          is_taxable?: boolean | null
          item_code?: string | null
          item_description?: string
          pending_quantity?: number | null
          product_id?: string | null
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          remarks?: string | null
          sgst_amount?: number | null
          sgst_rate?: number | null
          taxable_value?: number | null
          total_price: number
          unit_of_measure?: string
          unit_price: number
        }
        Update: {
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          gst_rate?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          is_taxable?: boolean | null
          item_code?: string | null
          item_description?: string
          pending_quantity?: number | null
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          remarks?: string | null
          sgst_amount?: number | null
          sgst_rate?: number | null
          taxable_value?: number | null
          total_price?: number
          unit_of_measure?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          company_place_of_supply: string | null
          created_at: string
          created_by: string
          currency: string | null
          delivery_address_line1: string | null
          delivery_address_line2: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_postal_code: string | null
          delivery_state: string | null
          expected_date: string | null
          external_po_ref: string | null
          id: string
          notes: string | null
          order_date: string
          payment_terms: string | null
          po_number: string
          same_as_registered_address: boolean | null
          status: string
          subtotal_amount: number | null
          supplier_code: string | null
          supplier_contact_email: string | null
          supplier_contact_person: string | null
          supplier_contact_phone: string | null
          supplier_gstin: string | null
          supplier_id: string
          total_amount: number
          total_discount_amount: number | null
          total_tax_amount: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          company_place_of_supply?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          delivery_address_line1?: string | null
          delivery_address_line2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_postal_code?: string | null
          delivery_state?: string | null
          expected_date?: string | null
          external_po_ref?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_terms?: string | null
          po_number: string
          same_as_registered_address?: boolean | null
          status?: string
          subtotal_amount?: number | null
          supplier_code?: string | null
          supplier_contact_email?: string | null
          supplier_contact_person?: string | null
          supplier_contact_phone?: string | null
          supplier_gstin?: string | null
          supplier_id: string
          total_amount?: number
          total_discount_amount?: number | null
          total_tax_amount?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_place_of_supply?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          delivery_address_line1?: string | null
          delivery_address_line2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_postal_code?: string | null
          delivery_state?: string | null
          expected_date?: string | null
          external_po_ref?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          payment_terms?: string | null
          po_number?: string
          same_as_registered_address?: boolean | null
          status?: string
          subtotal_amount?: number | null
          supplier_code?: string | null
          supplier_contact_email?: string | null
          supplier_contact_person?: string | null
          supplier_contact_phone?: string | null
          supplier_gstin?: string | null
          supplier_id?: string
          total_amount?: number
          total_discount_amount?: number | null
          total_tax_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      return_order_header: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          customer_id: string
          customer_name: string
          delivery_address_line1: string | null
          delivery_address_line2: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_pin_code: string | null
          delivery_same_as_company: boolean
          id: string
          invoice_date: string
          invoice_id: string
          invoice_number: string
          notes: string | null
          reason_for_credit: string
          rso_date: string
          rso_number: string | null
          status: string
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          customer_id: string
          customer_name: string
          delivery_address_line1?: string | null
          delivery_address_line2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_pin_code?: string | null
          delivery_same_as_company?: boolean
          id?: string
          invoice_date: string
          invoice_id: string
          invoice_number: string
          notes?: string | null
          reason_for_credit: string
          rso_date?: string
          rso_number?: string | null
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          customer_name?: string
          delivery_address_line1?: string | null
          delivery_address_line2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_pin_code?: string | null
          delivery_same_as_company?: boolean
          id?: string
          invoice_date?: string
          invoice_id?: string
          invoice_number?: string
          notes?: string | null
          reason_for_credit?: string
          rso_date?: string
          rso_number?: string | null
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      return_order_lines: {
        Row: {
          cgst_amount: number | null
          cgst_rate: number | null
          created_at: string
          discount_amount: number
          discount_percentage: number | null
          hsn_sac_code: string | null
          id: string
          igst_amount: number | null
          igst_rate: number | null
          invoice_qty: number
          line_subtotal: number
          line_total: number
          pending_return_qty: number
          product_id: string
          product_name: string
          product_sku: string
          return_order_id: string
          return_qty: number
          sgst_amount: number | null
          sgst_rate: number | null
          tax_amount: number
          unit_of_measure: string
          unit_price: number
        }
        Insert: {
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          invoice_qty: number
          line_subtotal?: number
          line_total?: number
          pending_return_qty?: number
          product_id: string
          product_name: string
          product_sku: string
          return_order_id: string
          return_qty?: number
          sgst_amount?: number | null
          sgst_rate?: number | null
          tax_amount?: number
          unit_of_measure?: string
          unit_price?: number
        }
        Update: {
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          invoice_qty?: number
          line_subtotal?: number
          line_total?: number
          pending_return_qty?: number
          product_id?: string
          product_name?: string
          product_sku?: string
          return_order_id?: string
          return_qty?: number
          sgst_amount?: number | null
          sgst_rate?: number | null
          tax_amount?: number
          unit_of_measure?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_order_lines_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "return_order_header"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_items: {
        Row: {
          backorder_quantity: number
          bin_id: string | null
          cgst_amount: number | null
          cgst_rate: number | null
          created_at: string
          discount_amount: number
          discount_percentage: number | null
          hsn_sac_code: string | null
          id: string
          igst_amount: number | null
          igst_rate: number | null
          item_code: string
          item_description: string
          line_subtotal: number
          line_total: number
          product_id: string
          quantity_invoiced: number
          quantity_ordered: number
          sales_invoice_id: string
          sgst_amount: number | null
          sgst_rate: number | null
          tax_amount: number
          unit_of_measure: string
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          backorder_quantity?: number
          bin_id?: string | null
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          item_code: string
          item_description: string
          line_subtotal?: number
          line_total?: number
          product_id: string
          quantity_invoiced?: number
          quantity_ordered?: number
          sales_invoice_id: string
          sgst_amount?: number | null
          sgst_rate?: number | null
          tax_amount?: number
          unit_of_measure?: string
          unit_price?: number
          warehouse_id?: string | null
        }
        Update: {
          backorder_quantity?: number
          bin_id?: string | null
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          item_code?: string
          item_description?: string
          line_subtotal?: number
          line_total?: number
          product_id?: string
          quantity_invoiced?: number
          quantity_ordered?: number
          sales_invoice_id?: string
          sgst_amount?: number | null
          sgst_rate?: number | null
          tax_amount?: number
          unit_of_measure?: string
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_items_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          account_manager: string | null
          amount_in_words: string | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_pin_code: string | null
          billing_state: string | null
          company_id: string
          created_at: string
          created_by: string
          currency: string | null
          customer_id: string
          customer_name: string
          customer_po_reference: string | null
          default_bin_id: string | null
          default_warehouse_id: string | null
          delivery_note_number: string | null
          discount_amount: number
          due_date: string | null
          freight_charges: number | null
          id: string
          invoice_date: string
          invoice_number: string | null
          mode_of_delivery: string | null
          notes: string | null
          packing_charges: number | null
          payment_terms: string | null
          round_off: number | null
          sales_order_id: string | null
          salesperson_id: string | null
          same_as_billing_address: boolean | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_pin_code: string | null
          shipping_state: string | null
          status: string
          subtotal_amount: number
          tax_amount: number
          total_amount: number
          transporter: string | null
          updated_at: string
        }
        Insert: {
          account_manager?: string | null
          amount_in_words?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_pin_code?: string | null
          billing_state?: string | null
          company_id: string
          created_at?: string
          created_by: string
          currency?: string | null
          customer_id: string
          customer_name: string
          customer_po_reference?: string | null
          default_bin_id?: string | null
          default_warehouse_id?: string | null
          delivery_note_number?: string | null
          discount_amount?: number
          due_date?: string | null
          freight_charges?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          mode_of_delivery?: string | null
          notes?: string | null
          packing_charges?: number | null
          payment_terms?: string | null
          round_off?: number | null
          sales_order_id?: string | null
          salesperson_id?: string | null
          same_as_billing_address?: boolean | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_pin_code?: string | null
          shipping_state?: string | null
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          transporter?: string | null
          updated_at?: string
        }
        Update: {
          account_manager?: string | null
          amount_in_words?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_pin_code?: string | null
          billing_state?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          currency?: string | null
          customer_id?: string
          customer_name?: string
          customer_po_reference?: string | null
          default_bin_id?: string | null
          default_warehouse_id?: string | null
          delivery_note_number?: string | null
          discount_amount?: number
          due_date?: string | null
          freight_charges?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          mode_of_delivery?: string | null
          notes?: string | null
          packing_charges?: number | null
          payment_terms?: string | null
          round_off?: number | null
          sales_order_id?: string | null
          salesperson_id?: string | null
          same_as_billing_address?: boolean | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_pin_code?: string | null
          shipping_state?: string | null
          status?: string
          subtotal_amount?: number
          tax_amount?: number
          total_amount?: number
          transporter?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_default_bin_id_fkey"
            columns: ["default_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          back_order_quantity: number | null
          bin_id: string | null
          cgst_amount: number | null
          cgst_rate: number | null
          created_at: string
          discount_amount: number
          discount_percentage: number | null
          hsn_sac_code: string | null
          id: string
          igst_amount: number | null
          igst_rate: number | null
          item_description: string
          line_no: number | null
          net_amount: number | null
          ordered_quantity: number | null
          product_id: string
          quantity: number
          sales_order_id: string
          sgst_amount: number | null
          sgst_rate: number | null
          stock_on_hand: number | null
          tax_percentage: number | null
          total_price: number
          unit_of_measure: string
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          back_order_quantity?: number | null
          bin_id?: string | null
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          item_description?: string
          line_no?: number | null
          net_amount?: number | null
          ordered_quantity?: number | null
          product_id: string
          quantity: number
          sales_order_id: string
          sgst_amount?: number | null
          sgst_rate?: number | null
          stock_on_hand?: number | null
          tax_percentage?: number | null
          total_price: number
          unit_of_measure?: string
          unit_price: number
          warehouse_id?: string | null
        }
        Update: {
          back_order_quantity?: number | null
          bin_id?: string | null
          cgst_amount?: number | null
          cgst_rate?: number | null
          created_at?: string
          discount_amount?: number
          discount_percentage?: number | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number | null
          igst_rate?: number | null
          item_description?: string
          line_no?: number | null
          net_amount?: number | null
          ordered_quantity?: number | null
          product_id?: string
          quantity?: number
          sales_order_id?: string
          sgst_amount?: number | null
          sgst_rate?: number | null
          stock_on_hand?: number | null
          tax_percentage?: number | null
          total_price?: number
          unit_of_measure?: string
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          account_manager: string | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_pin_code: string | null
          billing_state: string | null
          company_id: string
          created_at: string
          created_by: string
          currency: string | null
          customer_id: string
          customer_po_number: string | null
          customer_reference_no: string | null
          default_bin_id: string | null
          default_warehouse_id: string | null
          delivery_address_line1: string | null
          delivery_address_line2: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_date: string | null
          delivery_pin_code: string | null
          delivery_state: string | null
          discount_amount: number
          expected_delivery_date: string | null
          id: string
          mode_of_transport: string | null
          notes: string | null
          order_date: string
          order_number: string
          order_type: string | null
          payment_terms: string | null
          salesperson_id: string | null
          same_as_registered_address: boolean | null
          shipping_instructions: string | null
          status: string
          subtotal_amount: number | null
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_manager?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_pin_code?: string | null
          billing_state?: string | null
          company_id: string
          created_at?: string
          created_by: string
          currency?: string | null
          customer_id: string
          customer_po_number?: string | null
          customer_reference_no?: string | null
          default_bin_id?: string | null
          default_warehouse_id?: string | null
          delivery_address_line1?: string | null
          delivery_address_line2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_date?: string | null
          delivery_pin_code?: string | null
          delivery_state?: string | null
          discount_amount?: number
          expected_delivery_date?: string | null
          id?: string
          mode_of_transport?: string | null
          notes?: string | null
          order_date?: string
          order_number: string
          order_type?: string | null
          payment_terms?: string | null
          salesperson_id?: string | null
          same_as_registered_address?: boolean | null
          shipping_instructions?: string | null
          status?: string
          subtotal_amount?: number | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          account_manager?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_pin_code?: string | null
          billing_state?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          currency?: string | null
          customer_id?: string
          customer_po_number?: string | null
          customer_reference_no?: string | null
          default_bin_id?: string | null
          default_warehouse_id?: string | null
          delivery_address_line1?: string | null
          delivery_address_line2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_date?: string | null
          delivery_pin_code?: string | null
          delivery_state?: string | null
          discount_amount?: number
          expected_delivery_date?: string | null
          id?: string
          mode_of_transport?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string
          order_type?: string | null
          payment_terms?: string | null
          salesperson_id?: string | null
          same_as_registered_address?: boolean | null
          shipping_instructions?: string | null
          status?: string
          subtotal_amount?: number | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_default_bin_fk"
            columns: ["default_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_default_warehouse_fk"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      stock_transfers: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          from_bin_id: string
          from_warehouse_id: string
          id: string
          product_id: string
          quantity: number
          reason: string
          remarks: string | null
          to_bin_id: string
          to_warehouse_id: string
          transfer_number: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          from_bin_id: string
          from_warehouse_id: string
          id?: string
          product_id: string
          quantity: number
          reason: string
          remarks?: string | null
          to_bin_id: string
          to_warehouse_id: string
          transfer_number?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          from_bin_id?: string
          from_warehouse_id?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string
          remarks?: string | null
          to_bin_id?: string
          to_warehouse_id?: string
          transfer_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          business_id: string | null
          created_at: string
          currency: string | null
          end_date: string | null
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          plan_type: Database["public"]["Enums"]["subscription_plan"] | null
          start_date: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          business_id?: string | null
          created_at?: string
          currency?: string | null
          end_date?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          plan_type?: Database["public"]["Enums"]["subscription_plan"] | null
          start_date?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          business_id?: string | null
          created_at?: string
          currency?: string | null
          end_date?: string | null
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          plan_type?: Database["public"]["Enums"]["subscription_plan"] | null
          start_date?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          account_number: string | null
          account_type: string | null
          address: string | null
          address_line1: string | null
          address_line2: string | null
          bank_address: string | null
          bank_name: string | null
          branch_name: string | null
          business_registration_no: string | null
          city: string | null
          company_id: string
          contact_person: string | null
          country: string | null
          created_at: string
          credit_time: number | null
          dispatch_address_line1: string | null
          dispatch_address_line2: string | null
          dispatch_city: string | null
          dispatch_country: string | null
          dispatch_pin_code: string | null
          dispatch_state: string | null
          email: string | null
          gst_number: string | null
          id: string
          ifsc_code: string | null
          is_active: boolean
          name: string
          pan_number: string | null
          payment_terms: string | null
          phone: string | null
          pin_code: string | null
          place_of_supply: string | null
          preferred_currency: string | null
          same_as_registered_address: boolean | null
          state: string | null
          supplier_ref: string | null
          supplier_type: string | null
          swift_code: string | null
          tax_id: string | null
          updated_at: string
          vendor_registered_address: string | null
          website: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          bank_address?: string | null
          bank_name?: string | null
          branch_name?: string | null
          business_registration_no?: string | null
          city?: string | null
          company_id: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_time?: number | null
          dispatch_address_line1?: string | null
          dispatch_address_line2?: string | null
          dispatch_city?: string | null
          dispatch_country?: string | null
          dispatch_pin_code?: string | null
          dispatch_state?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          name: string
          pan_number?: string | null
          payment_terms?: string | null
          phone?: string | null
          pin_code?: string | null
          place_of_supply?: string | null
          preferred_currency?: string | null
          same_as_registered_address?: boolean | null
          state?: string | null
          supplier_ref?: string | null
          supplier_type?: string | null
          swift_code?: string | null
          tax_id?: string | null
          updated_at?: string
          vendor_registered_address?: string | null
          website?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          address?: string | null
          address_line1?: string | null
          address_line2?: string | null
          bank_address?: string | null
          bank_name?: string | null
          branch_name?: string | null
          business_registration_no?: string | null
          city?: string | null
          company_id?: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          credit_time?: number | null
          dispatch_address_line1?: string | null
          dispatch_address_line2?: string | null
          dispatch_city?: string | null
          dispatch_country?: string | null
          dispatch_pin_code?: string | null
          dispatch_state?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          name?: string
          pan_number?: string | null
          payment_terms?: string | null
          phone?: string | null
          pin_code?: string | null
          place_of_supply?: string | null
          preferred_currency?: string | null
          same_as_registered_address?: boolean | null
          state?: string | null
          supplier_ref?: string | null
          supplier_type?: string | null
          swift_code?: string | null
          tax_id?: string | null
          updated_at?: string
          vendor_registered_address?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_audit_log: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_access: {
        Row: {
          company_id: string
          granted_at: string | null
          granted_by: string | null
          id: string
          is_active: boolean | null
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_bins: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bin_name: string
          city: string | null
          company_id: string
          contact_person_email: string | null
          contact_person_name: string | null
          contact_person_phone: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          postal_code: string | null
          state: string | null
          updated_at: string
          warehouse_code: string | null
          warehouse_name: string | null
          wh_bin_code: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bin_name: string
          city?: string | null
          company_id: string
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          warehouse_code?: string | null
          warehouse_name?: string | null
          wh_bin_code: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bin_name?: string
          city?: string | null
          company_id?: string
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          warehouse_code?: string | null
          warehouse_name?: string | null
          wh_bin_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_bins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      credit_note_stats: {
        Row: {
          company_id: string | null
          confirmed_amount: number | null
          confirmed_count: number | null
          draft_amount: number | null
          draft_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_credit_notes_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      current_stock_levels: {
        Row: {
          bin_id: string | null
          company_id: string | null
          current_stock: number | null
          last_transaction_date: string | null
          product_id: string | null
          transaction_count: number | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_transactions_bin_id"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inventory_transactions_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inventory_transactions_warehouse_id"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_manage_user_role: {
        Args: { current_user_id?: string; target_role: string }
        Returns: boolean
      }
      check_email_exists: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      check_security_anomalies: {
        Args: Record<PropertyKey, never>
        Returns: {
          anomaly_type: string
          count: number
          details: Json
        }[]
      }
      cleanup_expired_otps: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_tokens: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      confirm_return_order: {
        Args: { p_return_order_id: string }
        Returns: Json
      }
      create_return_order: {
        Args:
          | {
              p_company_id: string
              p_customer_id: string
              p_delivery_address_line1?: string
              p_delivery_address_line2?: string
              p_delivery_city?: string
              p_delivery_country?: string
              p_delivery_pin_code?: string
              p_delivery_same_as_company?: boolean
              p_invoice_id: string
              p_notes?: string
              p_reason_for_credit: string
              p_return_lines: Json
            }
          | {
              p_company_id: string
              p_customer_id: string
              p_delivery_address_line1?: string
              p_delivery_address_line2?: string
              p_delivery_city?: string
              p_delivery_country?: string
              p_delivery_pin_code?: string
              p_delivery_same_as_company?: boolean
              p_invoice_id: string
              p_notes?: string
              p_reason_for_credit: string
              p_return_lines: Json
              p_status?: string
            }
        Returns: Json
      }
      delete_confirmed_return_order: {
        Args: { p_return_order_id: string }
        Returns: Json
      }
      find_and_fix_missing_grn_transactions: {
        Args: { p_company_id?: string }
        Returns: {
          grn_id: string
          grn_number: string
          missing_transactions: number
          processing_result: Json
          status: string
        }[]
      }
      generate_business_ref: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_business_ref_no: {
        Args: { company_name: string }
        Returns: string
      }
      generate_cn_number: {
        Args: { comp_id: string }
        Returns: string
      }
      generate_company_invoice_number: {
        Args: { comp_id: string }
        Returns: string
      }
      generate_customer_id: {
        Args: { customer_name: string }
        Returns: string
      }
      generate_customer_ref: {
        Args: { customer_name: string }
        Returns: string
      }
      generate_gated_business_ref_no: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_grn_number: {
        Args: { comp_id: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: { comp_id: string }
        Returns: string
      }
      generate_performa_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_po_number: {
        Args: { comp_id: string }
        Returns: string
      }
      generate_rso_number: {
        Args: { p_company_id: string; p_customer_id: string }
        Returns: string
      }
      generate_so_number: {
        Args: { comp_id: string }
        Returns: string
      }
      generate_supplier_ref: {
        Args: { supplier_name: string }
        Returns: string
      }
      generate_transfer_number: {
        Args: { comp_id: string }
        Returns: string
      }
      generate_user_ref: {
        Args: { comp_id: string }
        Returns: string
      }
      get_current_company_context: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_invoice_returned_quantities: {
        Args: { p_invoice_id: string }
        Returns: {
          product_id: string
          returned_qty: number
        }[]
      }
      get_purchase_order_status: {
        Args: { po_id: string }
        Returns: string
      }
      get_return_order_stats: {
        Args: { p_company_id: string }
        Returns: Json
      }
      get_sales_metrics: {
        Args: { p_company_id: string }
        Returns: {
          pending_orders_count: number
          pending_orders_value: number
          total_backorder_units: number
          total_backorder_value: number
        }[]
      }
      get_sales_order_delivery_summary: {
        Args: { p_sales_order_id: string }
        Returns: {
          delivery_status: string
          total_backorder_qty: number
          total_invoiced_qty: number
          total_ordered_qty: number
        }[]
      }
      get_sales_order_item_remaining_quantities: {
        Args: { p_sales_order_id: string }
        Returns: {
          current_backorder_qty: number
          hsn_sac_code: string
          product_id: string
          product_name: string
          product_sku: string
          quantity_already_invoiced: number
          quantity_ordered: number
          quantity_remaining: number
          unit_of_measure: string
          unit_price: number
        }[]
      }
      get_sales_orders_with_delivery_summary: {
        Args: { p_company_id: string }
        Returns: {
          created_at: string
          currency: string
          customer_id: string
          customer_name: string
          customer_po_number: string
          customer_ref: string
          delivery_status: string
          id: string
          order_date: string
          order_number: string
          status: string
          total_amount: number
          total_backorder_qty: number
          total_invoiced_qty: number
          total_ordered_qty: number
        }[]
      }
      get_top_backorder_customers: {
        Args: { p_company_id: string; p_limit?: number }
        Returns: {
          customer_name: string
          customer_ref: string
          total_backorder_amount: number
        }[]
      }
      get_top_backorder_items: {
        Args: { p_company_id: string; p_limit?: number }
        Returns: {
          product_name: string
          product_sku: string
          total_backorder_qty: number
        }[]
      }
      get_user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      process_bom_production: {
        Args: {
          p_bin_id?: string
          p_bom_id: string
          p_company_id: string
          p_created_by?: string
          p_quantity: number
          p_warehouse_id: string
        }
        Returns: Json
      }
      process_credit_note_inventory: {
        Args: { p_credit_note_id: string }
        Returns: Json
      }
      process_grn_inventory: {
        Args: { p_grn_id: string }
        Returns: undefined
      }
      process_grn_inventory_enhanced: {
        Args: { p_grn_id: string }
        Returns: Json
      }
      process_sales_invoice: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      record_inventory_transaction: {
        Args: {
          p_bin_id: string
          p_company_id: string
          p_created_by?: string
          p_notes?: string
          p_product_id: string
          p_quantity_change: number
          p_reference_id: string
          p_reference_number: string
          p_transaction_type: Database["public"]["Enums"]["transaction_type"]
          p_unit_cost?: number
          p_warehouse_id: string
        }
        Returns: string
      }
      user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "staff"
      business_status: "active" | "inactive" | "suspended"
      company_status: "active" | "inactive" | "suspended"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      subscription_plan: "monthly" | "yearly"
      transaction_type:
        | "purchase_receipt"
        | "sales_issue"
        | "adjustment_positive"
        | "adjustment_negative"
        | "transfer_out"
        | "transfer_in"
        | "sales_invoice"
        | "sales_return"
        | "production_receipt"
        | "production_consumption"
      user_role: "Admin" | "User" | "ViewOnly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "manager", "staff"],
      business_status: ["active", "inactive", "suspended"],
      company_status: ["active", "inactive", "suspended"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      subscription_plan: ["monthly", "yearly"],
      transaction_type: [
        "purchase_receipt",
        "sales_issue",
        "adjustment_positive",
        "adjustment_negative",
        "transfer_out",
        "transfer_in",
        "sales_invoice",
        "sales_return",
        "production_receipt",
        "production_consumption",
      ],
      user_role: ["Admin", "User", "ViewOnly"],
    },
  },
} as const
