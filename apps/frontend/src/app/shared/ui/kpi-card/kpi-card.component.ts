import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  template: `
    <mat-card class="kpi-card" [class]="tone()">
      <div>
        <span>{{ label() }}</span>
        <strong>{{ value() }}</strong>
      </div>
      <mat-icon>{{ icon() }}</mat-icon>
    </mat-card>
  `,
  styleUrls: ['./kpi-card.component.css'],
})
export class KpiCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  icon = input('analytics');
  tone = input<'primary' | 'secondary' | 'success' | 'warning' | 'danger'>('primary');
}
