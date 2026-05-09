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
import { extractApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-register-page',
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
          <mat-icon>favorite</mat-icon>
        </div>
        <h1>Регистрация заводчика</h1>
        <p>Создайте профиль, чтобы добавлять котов и начинать диалоги.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>Username</mat-label>
            <input matInput formControlName="username" autocomplete="username" />
            @if (form.controls.username.hasError('required')) {
              <mat-error>Укажите username</mat-error>
            }
          </mat-form-field>

          <div class="two-columns">
            <mat-form-field appearance="outline">
              <mat-label>Имя</mat-label>
              <input matInput formControlName="first_name" autocomplete="given-name" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Фамилия</mat-label>
              <input matInput formControlName="last_name" autocomplete="family-name" />
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Пароль</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
            @if (form.controls.password.hasError('required')) {
              <mat-error>Укажите пароль</mat-error>
            }
          </mat-form-field>

          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading">
            @if (loading) {
              <mat-spinner diameter="20" />
            } @else {
              <span>Зарегистрироваться</span>
            }
          </button>
        </form>

        <div class="auth-footer">
          Уже есть аккаунт?
          <a routerLink="/login">Войти</a>
        </div>
      </mat-card>
    </section>
  `,
  styleUrl: './auth-page.component.scss',
})
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  loading = false;
  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    first_name: [''],
    last_name: [''],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.auth.register(this.form.getRawValue())
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe({
        next: () => {
          this.snackBar.open('Регистрация завершена. Теперь можно войти.', 'Закрыть', { duration: 4000 });
          void this.router.navigate(['/login']);
        },
        error: (error: unknown) => {
          this.snackBar.open(extractApiError(error), 'Закрыть', { duration: 4500 });
        },
      });
  }
}
