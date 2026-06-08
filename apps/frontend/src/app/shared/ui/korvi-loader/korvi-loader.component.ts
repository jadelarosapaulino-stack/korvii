import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type KorviLoaderVariant = 'text' | 'data' | 'mobility';
type KorviLoaderTone = 'light' | 'dark';

@Component({
  selector: 'app-korvi-loader',
  standalone: true,
  template: `
    <div
      class="korvi-loader"
      [class.korvi-loader--dark]="tone === 'dark'"
      [class.korvi-loader--risk]="variant === 'mobility'"
      role="status"
      aria-live="polite"
      [attr.aria-label]="ariaLabel"
    >
      <div class="korvi-loader__brand">
        <span>K</span><span>O</span><span>R</span><span>V</span><span>I</span>
        @if (suffix) {
          <span class="korvi-loader__suffix"> {{ suffix }}</span>
        }
      </div>
      <div class="korvi-loader__label">{{ label }}</div>

      @if (variant === 'data') {
      <div class="korvi-loader__nodes" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      } @else {
        <div class="korvi-loader__bar" aria-hidden="true"></div>
      }
    </div>
  `,
  styleUrls: ['./korvi-loader.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KorviLoaderComponent {
  @Input() variant: KorviLoaderVariant = 'text';
  @Input() tone: KorviLoaderTone = 'light';

  get suffix(): string {
    if (this.variant === 'data') return 'Insight';
    if (this.variant === 'mobility') return 'Drive';
    return '';
  }

  get label(): string {
    if (this.variant === 'data') return 'Analysing risk signals';
    if (this.variant === 'mobility') return 'Syncing mobility intelligence';
    return 'Smart Mobility Platform';
  }

  get ariaLabel(): string {
    return `Cargando KORVI. ${this.label}`;
  }
}
