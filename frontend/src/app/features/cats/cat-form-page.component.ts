import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, finalize } from 'rxjs';
import { extractApiError } from '../../core/api/api-error';
import { CatsApiService } from '../../core/api/cats-api.service';
import { Cat, CatFormValue, CoatType } from '../../core/models/cat.model';

@Component({
  selector: 'app-cat-form-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <section class="form-page">
      <a mat-button routerLink="/cats" class="back-link">
        <mat-icon>arrow_back</mat-icon>
        К списку котов
      </a>

      <mat-card class="form-card">
        <h1>{{ isEdit ? 'Редактировать кота' : 'Добавить кота' }}</h1>

        @if (loading()) {
          <div class="center-state">
            <mat-spinner diameter="42" />
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="grid two">
              <mat-form-field appearance="outline">
                <mat-label>Имя</mat-label>
                <input matInput formControlName="name" />
                @if (form.controls.name.hasError('required')) {
                  <mat-error>Укажите имя кота</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Порода</mat-label>
                <input matInput formControlName="breed" />
                @if (form.controls.breed.hasError('required')) {
                  <mat-error>Укажите породу</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="grid three">
              <mat-form-field appearance="outline">
                <mat-label>Лет</mat-label>
                <input matInput type="number" min="0" max="40" formControlName="years" />
                @if (form.controls.years.invalid) {
                  <mat-error>От 0 до 40</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Месяцев</mat-label>
                <input matInput type="number" min="0" max="11" formControlName="months" />
                @if (form.controls.months.invalid) {
                  <mat-error>От 0 до 11</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Тип шерсти</mat-label>
                <mat-select formControlName="coat_type">
                  <mat-option [value]="null">Не указан</mat-option>
                  @for (coatType of coatTypes(); track coatType.slug) {
                    <mat-option [value]="coatType.slug">{{ coatType.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            <label class="file-control">
              <input type="file" accept="image/*" (change)="onFileSelected($event)" />
              <mat-icon>add_photo_alternate</mat-icon>
              <span>{{ selectedFileName() || currentPhotoLabel() }}</span>
            </label>

            @if (currentPhotoUrl() && !selectedFileName()) {
              <img class="photo-preview" [src]="currentPhotoUrl()" alt="Текущее фото кота" />
            }

            <div class="actions">
              <a mat-button routerLink="/cats">Отмена</a>
              <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving()">
                @if (saving()) {
                  <mat-spinner diameter="20" />
                } @else {
                  <span>Сохранить</span>
                }
              </button>
            </div>
          </form>
        }
      </mat-card>
    </section>
  `,
  styleUrl: './cat-form-page.component.scss',
})
export class CatFormPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catsApi = inject(CatsApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly publicId = this.route.snapshot.paramMap.get('publicId');
  readonly isEdit = Boolean(this.publicId);

  readonly coatTypes = signal<CoatType[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  selectedFile: File | null = null;
  readonly selectedFileName = signal('');
  readonly currentPhotoUrl = signal<string | null>(null);
  readonly currentPhotoLabel = signal('Выбрать фото');

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    breed: ['', Validators.required],
    years: [0, [Validators.required, Validators.min(0), Validators.max(40)]],
    months: [0, [Validators.required, Validators.min(0), Validators.max(11)]],
    coat_type: this.fb.control<string | null>(null),
  });

  constructor() {
    this.form.controls.years.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((years) => {
        if (Number(years) === 40 && this.form.controls.months.value !== 0) {
          this.form.controls.months.setValue(0);
        }
      });

    this.loadInitialData();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    this.selectedFile = file;
    this.selectedFileName.set(file?.name ?? '');
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    if (payload.age_months < 0 || payload.age_months > 480) {
      this.snackBar.open('Возраст кота должен быть от 0 до 40 лет.', 'Закрыть', { duration: 4000 });
      return;
    }

    this.saving.set(true);
    const request$ = this.publicId
      ? this.catsApi.updateCat(this.publicId, payload)
      : this.catsApi.createCat(payload);

    request$
      .pipe(
        finalize(() => {
          this.saving.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Карточка кота сохранена.', 'Закрыть', { duration: 3000 });
          void this.router.navigate(['/cats']);
        },
        error: (error: unknown) => {
          this.snackBar.open(extractApiError(error), 'Закрыть', { duration: 4500 });
        },
      });
  }

  private loadInitialData(): void {
    const coatTypes$ = this.catsApi.getCoatTypes();
    if (this.publicId) {
      forkJoin({ coatTypes: coatTypes$, cat: this.catsApi.getCat(this.publicId) })
        .pipe(
          finalize(() => {
            this.loading.set(false);
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (response) => {
            this.coatTypes.set(response.coatTypes.results);
            this.applyCat(response.cat);
          },
          error: (error: unknown) => {
            this.snackBar.open(extractApiError(error), 'Закрыть', { duration: 4500 });
          },
        });
      return;
    }

    coatTypes$
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.coatTypes.set(response.results);
        },
        error: (error: unknown) => {
          this.snackBar.open(extractApiError(error), 'Закрыть', { duration: 4500 });
        },
      });
  }

  private applyCat(cat: Cat): void {
    this.currentPhotoUrl.set(cat.photo_url);
    this.currentPhotoLabel.set(cat.photo_url ? 'Заменить фото' : 'Выбрать фото');
    this.form.patchValue({
      name: cat.name,
      breed: cat.breed,
      years: Math.floor(cat.age_months / 12),
      months: cat.age_months % 12,
      coat_type: cat.coat_type,
    });
  }

  private buildPayload(): CatFormValue {
    const value = this.form.getRawValue();
    const years = Number(value.years);
    const months = years === 40 ? 0 : Number(value.months);
    return {
      name: value.name.trim(),
      breed: value.breed.trim(),
      age_months: years * 12 + months,
      coat_type: value.coat_type || null,
      photo: this.selectedFile,
    };
  }
}
