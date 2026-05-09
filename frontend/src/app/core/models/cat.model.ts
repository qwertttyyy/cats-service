export interface CoatType {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
}

export interface Cat {
  public_id: string;
  name: string;
  age_months: number;
  age_display: string;
  breed: string;
  coat_type: string | null;
  coat_type_detail: CoatType | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CatFormValue {
  name: string;
  breed: string;
  age_months: number;
  coat_type: string | null;
  photo?: File | null;
}
