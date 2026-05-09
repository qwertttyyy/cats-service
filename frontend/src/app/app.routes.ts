import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AppLayoutComponent } from './layout/app-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent),
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'cats' },
      {
        path: 'cats',
        loadComponent: () => import('./features/cats/cat-list-page.component').then((m) => m.CatListPageComponent),
      },
      {
        path: 'cats/new',
        loadComponent: () => import('./features/cats/cat-form-page.component').then((m) => m.CatFormPageComponent),
      },
      {
        path: 'cats/:publicId/edit',
        loadComponent: () => import('./features/cats/cat-form-page.component').then((m) => m.CatFormPageComponent),
      },
      {
        path: 'messages',
        loadComponent: () => import('./features/messages/messages-page.component').then((m) => m.MessagesPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'cats' },
];
