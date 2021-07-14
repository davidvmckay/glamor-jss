import {toCssValue} from 'jss';
import type {
  ToCssOptions,
  RuleOptions,
  Renderer as RendererInterface,
  JssStyle,
  JssValue,
  BaseRule
} from 'jss';

/**
 * Similar to invariant but only logs a warning if the condition is not met.
 * This can be used to log issues in development environments in critical
 * paths. Removing the logging code for production environments will keep the
 * same logic and follow the same code paths.
 */
export const warning = (condition, format, ...args) => {
  if (format === undefined)
    throw new Error( '`warning(condition, format, ...args)` requires a warning ' + 'message argument' );

  if (format.length < 10 || (/^[s\W]*$/).test(format))
    throw new Error( 'The warning format should be able to uniquely identify this ' + 'warning. Please, use a more descriptive format than: ' + format );

  if (!condition) {
    var argIndex = 0;
    var message = 'Warning: ' + format.replace(/%s/g, () => args[argIndex++]);
    console?.error(message);

    try {
      // This error was thrown as a convenience so that you can use this stack to find the callsite that caused this warning to fire.
      throw new Error(message);
    } catch(x) {}
  }
};

/** Indent a string. @see http://jsperf.com/array-join-vs-for */
const indentStr = (str: string, indent: number): string => {
  let result = '';
  for (let index = 0; index < indent; index++) result += '  ';
  return result + str;
};

/** Converts a Rule to CSS string. */
export const toCss = (selector: string, style: JssStyle, options: ToCssOptions = {}): string => {
  let result = '';
  if (!style) return result;
  let {indent = 0} = options;
  const {fallbacks} = style;
  indent++;

  // Apply fallbacks first.
  if (fallbacks) {
    // Array syntax {fallbacks: [{prop: value}]}
    if (Array.isArray(fallbacks)) {
      for (let index = 0; index < fallbacks.length; index++) {
        const fallback = fallbacks[index];
        for (const prop in fallback) {
          const value = fallback[prop];
          if (value != null)
            result += `\n${indentStr(`${prop}: ${toCssValue(value)};`, indent)}`;
        }
      }
    } else {
      // Object syntax {fallbacks: {prop: value}}
      for (const prop in fallbacks) {
        const value = fallbacks[prop];
        if (value != null)
          result += `\n${indentStr(`${prop}: ${toCssValue(value)};`, indent)}`;
      }
    }
  }

  for (const prop in style) {
    const value = style[prop];
    if (value != null && prop !== 'fallbacks')
      result += `\n${indentStr(`${prop}: ${toCssValue(value)};`, indent)}`;
  }

  // Allow empty style in this case, because properties will be added dynamically.
  if (!result && !options.allowEmpty) return result;
  indent--;
  result = indentStr(`${selector} {${result}\n`, indent) + indentStr('}', indent);
  return result;
}

export class MyStyleRule implements BaseRule {
  type = 'style';
  key: string;
  isProcessed: boolean = false;
  style: JssStyle;
  selectorText: string;
  originalSelectorText?: string;
  classSelector?: string;
  dataSelector?: string;
  renderer: RendererInterface;
  renderable?: CSSStyleRule;
  options: RuleOptions;
  parent?: BaseRule;

  constructor(key: string, style: JssStyle, options: RuleOptions) {
    this.key = key;
    this.options = options;
    this.style = style;
    this.selectorText = options.selector ?? `.css-${key}`;
    this.renderer = options.sheet?.renderer ?? new options.Renderer();
  }

  /**
   * Set selector string.
   * Attention: use this with caution. Most browsers didn't implement
   * selectorText setter, so this may result in rerendering of entire Style Sheet.
   */
  set selector(v: string) {
    if (v === this.selectorText) return;
    this.selectorText = v;
    if (!this.renderable) return;
    const hasChanged = this.renderer.setSelector(this.renderable, v);

    // If selector setter is not implemented, rerender the rule.
    if (!hasChanged && this.renderable) {
      const renderable = this.renderer.replaceRule(this.renderable, this);
      if (renderable) this.renderable = renderable;
    }
  }

  /** Get selector string. */
  get selector(): string { return this.selectorText }

  /** Get or set a style property. */
  prop(name: string, value?: JssValue): MyStyleRule | string {
    // It's a getter.
    if (value === undefined) return this.style[name];

    // Don't do anything if the value has not changed.
    if (this.style[name] === value) return this;
    value = this.options.jss.plugins.onChangeValue(value, name, this);
    const isEmpty = value == null || value === false;
    const isDefined = name in this.style;

    // Value is empty and wasn't defined before.
    if (isEmpty && !isDefined) return this;

    // We are going to remove this value.
    const remove = isEmpty && isDefined;
    if (remove) delete this.style[name];
    else this.style[name] = value;

    // Renderable is defined if StyleSheet option `link` is true.
    if (this.renderable) {
      if (remove) this.renderer.removeProperty(this.renderable, name);
      else this.renderer.setProperty(this.renderable, name, value);
      return this;
    }

    const {sheet} = this.options;
    if (sheet && sheet.attached)
      warning(false, 'Rule is not linked. Missing sheet option "link: true".');

    return this;
  }

  /** Apply rule to an element inline. */
  applyTo(renderable: HTMLElement): this {
    const json = this.toJSON();
    for (const prop in json) this.renderer.setProperty(renderable, prop, json[prop]);
    return this;
  }

  /** Returns JSON representation of the rule. Fallbacks are not supported. Useful for inline styles. */
  toJSON(): Object {
    const json = {};
    for (const prop in this.style) {
      const value = this.style[prop];
      if (typeof value !== 'object') json[prop] = value;
      else if (Array.isArray(value)) json[prop] = toCssValue(value);
    }

    return json;
  }

  /** Generates a CSS string. */
  toString(options?: ToCssOptions): string {
    const {sheet} = this.options;
    const link = sheet ? sheet.options.link : false;
    const opts = link ? {...options, allowEmpty: true} : options;
    return toCss(this.selector, this.style, opts);
  }
}
