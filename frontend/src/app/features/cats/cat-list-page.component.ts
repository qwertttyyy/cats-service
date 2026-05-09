import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { extractApiError } from '../../core/api/api-error';
import { CatsApiService } from '../../core/api/cats-api.service';
import { Cat } from '../../core/models/cat.model';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-cat-list-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    EmptyStateComponent,
  ],
  template: `
    <section class="page-head">
      <div>
        <p class="eyebrow">Питомник</p>
        <h1>Мои коты</h1>
      </div>
      <a mat-flat-button color="primary" routerLink="/cats/new">
        <mat-icon>add</mat-icon>
        Добавить кота
      </a>
    </section>

    @if (loading()) {
      <div class="center-state">
        <mat-spinner diameter="44" />
      </div>
    } @else if (cats().length === 0) {
      <app-empty-state
        icon="pets"
        title="У вас пока нет котов"
        description="Добавьте первую карточку кота, чтобы собрать профиль питомника."
      />
    } @else {
      <div class="cats-grid">
        @for (cat of cats(); track cat.public_id) {
          <mat-card class="cat-card">
            <div class="cat-photo">
              @if (cat.photo_url) {
                <img [src]="cat.photo_url" [alt]="cat.name" />
              } @else {
                <mat-icon>pets</mat-icon>
              }
            </div>
            <mat-card-content>
              <div class="cat-title">
                <h2>{{ cat.name }}</h2>
                <span>{{ cat.age_display }}</span>
              </div>
              <p>{{ cat.breed }}</p>
              @if (cat.coat_type_detail) {
                <div class="coat">
                  <mat-icon>texture</mat-icon>
                  {{ cat.coat_type_detail.name }}
                </div>
              }
            </mat-card-content>
            <mat-card-actions align="end">
              <a mat-button [routerLink]="['/cats', cat.public_id, 'edit']">
                <mat-icon>edit</mat-icon>
                Редактировать
              </a>
              <button mat-button color="warn" type="button" (click)="confirmDelete(cat)">
                <mat-icon>delete</mat-icon>
                Удалить
              </button>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    }
  `,
  styleUrl: './cat-list-page.component.scss',
})
export class CatListPageComponent {
  private readonly catsApi = inject(CatsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly cats = signal<Cat[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.loadCats();
  }

  confirmDelete(cat: Cat): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Удалить карточку кота?',
        message: `Кот "${cat.name}" исчезнет из вашего списка.`,
        confirmText: 'Удалить',
      },
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteCat(cat);
        }
      });
  }

  private loadCats(): void {
    this.loading.set(true);
    this.catsApi.getCats()
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.cats.set(response.results);
        },
        error: (error: unknown) => {
          this.snackBar.open(extractApiError(error), 'Закрыть', { duration: 4500 });
        },
      });
  }

  private deleteCat(cat: Cat): void {
    this.catsApi.deleteCat(cat.public_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cats.update((cats) => cats.filter((item) => item.public_id !== cat.public_id));
          this.snackBar.open('Карточка кота удалена.', 'Закрыть', { duration: 3000 });
        },
        error: (error: unknown) => {
          this.snackBar.open(extractApiError(error), 'Закрыть', { duration: 4500 });
        },
      });
  }
}
