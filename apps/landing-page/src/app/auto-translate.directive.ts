import { AfterViewInit, Directive, effect, ElementRef, inject, OnDestroy } from '@angular/core';
import { AppLanguage, I18nService } from './i18n.service';

const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];

@Directive({
  selector: '[landingAutoTranslate]',
  standalone: true,
})
export class AutoTranslateDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18nService);
  private readonly originalText = new WeakMap<Text, string>();
  private readonly originalAttributes = new WeakMap<Element, Map<string, string>>();
  private observer?: MutationObserver;
  private applying = false;
  private renderedLanguage?: AppLanguage;

  constructor() {
    effect(() => {
      this.i18n.language();
      queueMicrotask(() => this.translateTree());
    });
  }

  ngAfterViewInit() {
    this.translateTree();
    this.observer = new MutationObserver(() => {
      if (this.applying) return;
      queueMicrotask(() => this.translateTree());
    });
    this.observer.observe(this.elementRef.nativeElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  private translateTree() {
    const root = this.elementRef.nativeElement;
    const language = this.i18n.language();
    const languageChanged = this.renderedLanguage !== undefined && this.renderedLanguage !== language;
    this.applying = true;
    try {
      this.translateElement(root, languageChanged);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          this.translateTextNode(node as Text, languageChanged);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          this.translateElement(node as Element, languageChanged);
        }
        node = walker.nextNode();
      }
    } finally {
      this.renderedLanguage = language;
      this.applying = false;
    }
  }

  private translateTextNode(node: Text, languageChanged: boolean) {
    if (this.isIgnoredTextNode(node)) return;
    const current = node.nodeValue ?? '';
    if (!this.originalText.has(node)) {
      this.originalText.set(node, current);
    } else if (this.i18n.language() === 'es') {
      if (languageChanged && current !== this.originalText.get(node)) {
        node.nodeValue = this.originalText.get(node) ?? current;
      } else {
        this.originalText.set(node, current);
      }
      return;
    } else if (!languageChanged && current !== this.i18n.translate(this.originalText.get(node))) {
      this.originalText.set(node, current);
    }

    const original = this.originalText.get(node) ?? current;
    const translated = this.i18n.translate(original);
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }

  private translateElement(element: Element, languageChanged: boolean) {
    if (this.isIgnoredElement(element)) return;

    let originals = this.originalAttributes.get(element);
    if (!originals) {
      originals = new Map<string, string>();
      this.originalAttributes.set(element, originals);
    }

    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      if (!originals.has(attribute)) originals.set(attribute, value);
      if (this.i18n.language() === 'es') {
        if (languageChanged && value !== originals.get(attribute)) {
          element.setAttribute(attribute, originals.get(attribute) ?? value);
        } else {
          originals.set(attribute, value);
        }
        continue;
      }
      const original = originals.get(attribute) ?? value;
      const translated = this.i18n.translate(original);
      if (value !== translated) element.setAttribute(attribute, translated);
    }
  }

  private isIgnoredTextNode(node: Text): boolean {
    if (!node.nodeValue?.trim()) return true;
    const parent = node.parentElement;
    return !parent || this.isIgnoredElement(parent);
  }

  private isIgnoredElement(element: Element): boolean {
    return ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'].includes(element.tagName) || element.hasAttribute('data-no-translate');
  }
}
