import { Component, computed, input } from '@angular/core';
import { reportStatusStyle } from '../../utils/report-status-style';

@Component({
  selector: 'app-status-chip',
  standalone: true,
  template: `<span class="status-chip" [class]="'status-chip ' + style().tone">{{ style().label }}</span>`,
  styleUrls: ['./status-chip.component.css'],
})
export class StatusChipComponent {
  status = input.required<string>();
  style = computed(() => reportStatusStyle(this.status()));
}
