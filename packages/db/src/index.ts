/**
 * @refontiq/db — Schéma et types de base de données
 * Package minimal pour le moment
 */

export interface Database {
  public: {
    Tables: Record<string, any>;
    Views: Record<string, any>;
    Functions: Record<string, any>;
    Enums: Record<string, any>;
  };
}
