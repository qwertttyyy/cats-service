import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SKIP_AUTH, SKIP_REFRESH } from './auth-context';

export const authInterceptor: HttpInterceptorFn = (request: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token;
  const authorizedRequest = token && !request.context.get(SKIP_AUTH)
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse
        && error.status === 401
        && !request.context.get(SKIP_REFRESH)
        && auth.hasRefreshToken
      ) {
        return auth.refreshAccessToken().pipe(
          switchMap((newToken) => next(request.clone({
            setHeaders: { Authorization: `Bearer ${newToken}` },
          }))),
          catchError((refreshError: unknown) => {
            auth.logout(false);
            void router.navigate(['/login']);
            return throwError(() => refreshError);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
