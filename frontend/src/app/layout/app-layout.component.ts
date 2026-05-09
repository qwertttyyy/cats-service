import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../core/auth/auth.service';
import { WebSocketService } from '../core/websocket/websocket.service';
import { User } from '../core/models/user.model';

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav #drawer mode="over" class="mobile-drawer">
        <a mat-button routerLink="/cats" routerLinkActive="active-link" (click)="drawer.close()">Мои коты</a>
        <a mat-button routerLink="/messages" routerLinkActive="active-link" (click)="drawer.close()">Сообщения</a>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="toolbar">
          <button mat-icon-button class="menu-button" type="button" (click)="drawer.toggle()" aria-label="Открыть меню">
            <mat-icon>menu</mat-icon>
          </button>

          <a class="brand" routerLink="/cats" aria-label="Cats Service">
            <mat-icon>pets</mat-icon>
            <span>Cats Service</span>
          </a>

          <nav class="desktop-nav">
            <a mat-button routerLink="/cats" routerLinkActive="active-link">Мои коты</a>
            <a mat-button routerLink="/messages" routerLinkActive="active-link">Сообщения</a>
          </nav>

          <span class="spacer"></span>

          <button mat-button [matMenuTriggerFor]="profileMenu" type="button" class="profile-button">
            <mat-icon>account_circle</mat-icon>
            <span>{{ user?.username || 'Профиль' }}</span>
          </button>
          <mat-menu #profileMenu="matMenu">
            <button mat-menu-item type="button" disabled>
              <mat-icon>person</mat-icon>
              <span>{{ fullName || user?.username }}</span>
            </button>
            <button mat-menu-item type="button" (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Выйти</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <main class="content">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ws = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  user: User | null = this.auth.currentUser;

  constructor() {
    this.auth.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.user = user;
      });
  }

  get fullName(): string {
    return [this.user?.first_name, this.user?.last_name].filter(Boolean).join(' ').trim();
  }

  logout(): void {
    this.ws.disconnect();
    this.auth.logout(false);
    void this.router.navigate(['/login']);
  }
}
