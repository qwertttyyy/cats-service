import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { extractApiError } from '../../core/api/api-error';

@Component({
  selector: 'app-login-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <section class="auth-page">
      <mat-card class="auth-card">
        <div class="auth-mark">
          <mat-icon>pets</mat-icon>
        </div>
        <h1>Вход для заводчиков</h1>
        <p>Управляйте котами и общайтесь с другими заводчиками.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Username</mat-label>
            <input matInput formControlName="username" autocomplete="username" />
            @if (form.controls.username.hasError('required')) {
              <mat-error>Укажите username</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Пароль</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="current-password" />
            @if (form.controls.password.hasError('required')) {
              <mat-error>Укажите пароль</mat-error>
            }
          </mat-form-field>

          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading">
            @if (loading) {
              <mat-spinner diameter="20" />
            } @else {
              <span>Войти</span>
            }
          </button>
        </form>

        <div class="auth-footer">
          Нет аккаунта?
          <a routerLink="/register">Зарегистрироваться</a>
        </div>
      </mat-card>
    </section>
  `,
  styleUrl: './auth-page.component.scss',
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  loading = false;
  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.auth.login(this.form.getRawValue())
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe({
        next: () => void this.router.navigate(['/cats']),
        error: (error: unknown) => {
          this.snackBar.open(extractApiError(error), 'Закрыть', { duration: 4500 });
        },
      });
  }
}
