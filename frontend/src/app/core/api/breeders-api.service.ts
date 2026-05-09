import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/pagination.model';
import { Breeder } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class BreedersApiService {
  private readonly http = inject(HttpClient);

  getBreeders(search = '', limit = 20, offset = 0): Observable<PaginatedResponse<Breeder>> {
    let params = new HttpParams()
      .set('limit', limit)
      .set('offset', offset);

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<PaginatedResponse<Breeder>>(`${environment.apiUrl}/breeders/`, { params });
  }
}
