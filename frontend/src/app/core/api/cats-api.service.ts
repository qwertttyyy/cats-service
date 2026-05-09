import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Cat, CatFormValue, CoatType } from '../models/cat.model';
import { PaginatedResponse } from '../models/pagination.model';

@Injectable({ providedIn: 'root' })
export class CatsApiService {
  private readonly http = inject(HttpClient);
  private coatTypesCache$?: Observable<PaginatedResponse<CoatType>>;

  getCats(): Observable<PaginatedResponse<Cat>> {
    return this.http.get<PaginatedResponse<Cat>>(`${environment.apiUrl}/cats/`);
  }

  getCat(publicId: string): Observable<Cat> {
    return this.http.get<Cat>(`${environment.apiUrl}/cats/${publicId}/`);
  }

  createCat(value: CatFormValue): Observable<Cat> {
    return this.http.post<Cat>(`${environment.apiUrl}/cats/`, this.toFormData(value));
  }

  updateCat(publicId: string, value: CatFormValue): Observable<Cat> {
    return this.http.patch<Cat>(`${environment.apiUrl}/cats/${publicId}/`, this.toFormData(value));
  }

  deleteCat(publicId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/cats/${publicId}/`);
  }

  getCoatTypes(): Observable<PaginatedResponse<CoatType>> {
    this.coatTypesCache$ ??= this.http.get<PaginatedResponse<CoatType>>(`${environment.apiUrl}/coat-types/`).pipe(
      shareReplay(1),
    );
    return this.coatTypesCache$;
  }

  private toFormData(value: CatFormValue): FormData {
    const data = new FormData();
    data.append('name', value.name);
    data.append('breed', value.breed);
    data.append('age_months', String(value.age_months));
    if (value.coat_type) {
      data.append('coat_type', value.coat_type);
    }
    if (value.photo) {
      data.append('photo', value.photo);
    }
    return data;
  }
}
