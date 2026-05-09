import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, RefreshTokenResponse, RegisterRequest, RegisterResponse, TokenPair } from '../models/auth.model';
import { User } from '../models/user.model';
import { SKIP_AUTH, SKIP_REFRESH } from '../interceptors/auth-context';

const REFRESH_TOKEN_KEY = 'cats_service_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private accessToken: string | null = null;
  private refreshRequest$: Observable<string> | null = null;
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);

  readonly currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get token(): string | null {
    return this.accessToken;
  }

  get hasRefreshToken(): boolean {
    return Boolean(this.getRefreshToken());
  }

  register(payload: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register/`, payload, {
      context: new HttpContext().set(SKIP_AUTH, true).set(SKIP_REFRESH, true),
    });
  }

  login(payload: LoginRequest): Observable<User> {
    return this.http.post<TokenPair>(`${environment.apiUrl}/auth/token/`, payload, {
      context: new HttpContext().set(SKIP_AUTH, true).set(SKIP_REFRESH, true),
    }).pipe(
      tap((tokens) => this.setTokens(tokens)),
      switchMap(() => this.loadMe()),
    );
  }

  loadMe(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/users/me/`).pipe(
      tap((user) => this.currentUserSubject.next(user)),
    );
  }

  ensureAuthenticated(): Observable<boolean> {
    if (this.accessToken && this.currentUser) {
      return of(true);
    }

    if (this.accessToken) {
      return this.loadMe().pipe(
        map(() => true),
        catchError(() => this.refreshThenLoadMe()),
      );
    }

    if (this.hasRefreshToken) {
      return this.refreshThenLoadMe();
    }

    return of(false);
  }

  refreshAccessToken(): Observable<string> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      return throwError(() => new Error('Нет refresh token.'));
    }

    if (!this.refreshRequest$) {
      this.refreshRequest$ = this.http.post<RefreshTokenResponse>(
        `${environment.apiUrl}/auth/token/refresh/`,
        { refresh },
        { context: new HttpContext().set(SKIP_AUTH, true).set(SKIP_REFRESH, true) },
      ).pipe(
        map((response) => response.access),
        tap((access) => {
          this.accessToken = access;
        }),
        finalize(() => {
          this.refreshRequest$ = null;
        }),
        shareReplay(1),
      );
    }

    return this.refreshRequest$;
  }

  logout(redirect = true): void {
    this.accessToken = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.currentUserSubject.next(null);
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  private refreshThenLoadMe(): Observable<boolean> {
    return this.refreshAccessToken().pipe(
      switchMap(() => this.loadMe()),
      map(() => true),
      catchError(() => {
        this.logout(false);
        return of(false);
      }),
    );
  }

  private setTokens(tokens: TokenPair): void {
    this.accessToken = tokens.access;
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
}
