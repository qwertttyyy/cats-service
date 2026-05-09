import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  template: `
    <div class="empty-state">
      <mat-icon>{{ icon() }}</mat-icon>
      <h3>{{ title() }}</h3>
      @if (description()) {
        <p>{{ description() }}</p>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 40px 20px;
      color: var(--muted-text);
      text-align: center;
    }

    mat-icon {
      width: 48px;
      height: 48px;
      color: var(--accent);
      font-size: 48px;
    }

    h3 {
      margin: 0;
      color: var(--text);
      font-size: 20px;
      font-weight: 700;
    }

    p {
      margin: 0;
      max-width: 420px;
      line-height: 1.5;
    }
  `],
})
export class EmptyStateComponent {
  readonly icon = input('pets');
  readonly title = input.required<string>();
  readonly description = input('');
}
