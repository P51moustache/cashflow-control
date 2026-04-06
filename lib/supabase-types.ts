export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          subscription_status: string;
          trial_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          subscription_status?: string;
          trial_end?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          amount: number;
          type: string;
          frequency: string;
          date: string;
          day_of_month: number | null;
          is_debt: boolean;
          debt_type: string | null;
          apr: number | null;
          current_balance: number | null;
          credit_limit: number | null;
          minimum_payment: number | null;
          extra_payment: number | null;
          projected_monthly_spend: number | null;
          spending_percentage: number | null;
          loan_term_months: number | null;
          is_flexible: boolean;
          exclude_from_spending: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<
          Database['public']['Tables']['transactions']['Row'],
          'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      user_settings: {
        Row: {
          id: number;
          user_id: string;
          current_balance: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current_balance?: number;
        };
        Update: Partial<Database['public']['Tables']['user_settings']['Insert']>;
      };
      debt_settings: {
        Row: {
          id: number;
          user_id: string;
          total_monthly_budget: number;
          total_monthly_payment_budget: number;
          payoff_strategy: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_monthly_budget?: number;
          total_monthly_payment_budget?: number;
          payoff_strategy?: string;
        };
        Update: Partial<Database['public']['Tables']['debt_settings']['Insert']>;
      };
      excluded_occurrences: {
        Row: {
          id: string;
          user_id: string;
          transaction_id: string;
          occurrence_date: string;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          transaction_id: string;
          occurrence_date: string;
        };
        Update: Partial<Database['public']['Tables']['excluded_occurrences']['Insert']>;
      };
    };
  };
}
