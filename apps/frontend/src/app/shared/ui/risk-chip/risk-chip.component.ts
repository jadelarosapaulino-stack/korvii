import { Component, computed, input } from '@angular/core';
import { riskLevelStyle } from '../../utils/risk-level-style';

@Component({
  selector: 'app-risk-chip',
  standalone: true,
  template: `<span class="risk-chip" [class]="'risk-chip ' + style().tone">{{ style().label }} · {{ level() }}/5</span>`,
  styleUrls: ['./risk-chip.component.css'],
})
export class RiskChipComponent {
  level = input.required<number>();
  style = computed(() => riskLevelStyle(Number(this.level())));
}
