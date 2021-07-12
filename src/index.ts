import * as _ from 'lodash';
import { create, StyleRule, SheetsRegistry } from 'jss';
import type { Rule, RuleOptions, StyleSheet, JssStyle }  from 'jss';
import preset from 'jss-preset-default';
import hashify from 'hash-it';
import { memoize, isEmptyObject, cleanup } from './memoize';

type Name = string | number | symbol;
const IS_DEV = process.env.NODE_ENV !== 'production';
const MAX_RULES = 65534;

const isDataSelector = (name?: string) => /\[data-.+\]/.test(name ?? '');
const jss = create(preset());

// render data-x selectors in addition to classNames (like glamor)
jss.use({
  onProcessRule: (rule: Rule & {selectorText: string}) => {
    console.log(rule);
    if (rule.type !== 'style' || !!(rule.options.parent as Rule)?.type || !!isDataSelector(rule.selectorText))
      return;

    // make dataSelector available for application in React code (or raw html as desired)
    const dataSelector = `data-${rule .selectorText ?.substring(1 )}`     ;
    const classSelector = dataSelector.replace('data-', '');

    // this is how the style rule actually matches (selctor written into css)
    const selectorText = `${     rule .selectorText }, [${ dataSelector}]`;
    Object.assign(rule, {dataSelector, selectorText, classSelector});
  },
});

// Replace :hover with &:hover, etc.
jss.use({
  // this callback supports overloads, so the code inside will be tricky...
  onCreateRule: (styleOrName: string | JssStyle, decl: JssStyle, options?: Partial<RuleOptions>) => {
    const style: any = decl ?? styleOrName ?? {};
    for (const key of _.keys(style)) {
      const k = key.trim();
      if (!k.startsWith(':') && !k.startsWith('>')) continue;
      style[`&${k}`] = style[k];
      delete style[k];
    }

    if (_.keys(style).length === 0)
      return null;

    const name = typeof styleOrName === 'string' ? styleOrName : undefined;
    return new StyleRule(name, style, options);
  },
});

type ManagerOptions = {
  sheetPrefix: string,
  classNamePrefix: string,
};

class Manager {
  #registry = new SheetsRegistry();
  #currentSheet = null as null | StyleSheet;
  #rulesCount = 0;
  #sheetCount = 0;
  #options = {} as ManagerOptions;
  constructor(options?: ManagerOptions) { this.#options = { sheetPrefix: 'glamor-jss', classNamePrefix: 'css', ...options }; }
  reset = () => { this.#registry.reset(); this.#currentSheet = null; };
  createSheet = () => {
    const sheet = jss.createStyleSheet({}, {
      // generateId: rule => `${this.#options.classNamePrefix}-${rule.key}`,
      // generateId: rule => `${this.#options.classNamePrefix}-${hashify((rule as any).style)}`,
      generateId: rule => `${this.#options.classNamePrefix}-${rule.key ?? hashify((rule as any).style)}`,
      meta: `${this.#options.sheetPrefix}-${this.#sheetCount++}`,
    });

    this.#registry.add(sheet);
    return sheet;
  };

  renderToString = () => this.#registry.toString();
  getSheet = () => this.#currentSheet ?? (this.#currentSheet = this.createSheet());
  addRule = (hash: Name, declarations: JssStyle, options?: Partial<RuleOptions>) => {
    const sheet = this.getSheet();

    // Detatch and attach again to make Chrome Dev Tools working
    // Similar to `speedy` from glamor: https://github.com/threepointone/glamor#speedy-mode
    if (IS_DEV) sheet.detach();
    const rule = sheet.addRule(hash, declarations, options);
    // https://blogs.msdn.microsoft.com/ieinternals/2011/05/14/stylesheet-limits-in-internet-explorer/
    if (++this.#rulesCount % MAX_RULES === 0)
      this.#currentSheet = this.createSheet();

    if (IS_DEV) sheet.attach();
    return rule as any as AugRule;
  };
}

export const __manager_test__ = { Manager, MAX_RULES };

const manager = new Manager();
type Writeable<T> = { -readonly [P in keyof T]: T[P] };
type AugRule = Rule & {debugOriginalSelector: string, dataSelector: string, classSelector: string};
type AugJssStyle = JssStyle & {hash?: number | string, values?: AugJssStyle[]};
type DataCss<K extends string = 'Css'> = {[k in `data-${K}`]: true};
const cache = {} as _.Dictionary<DataCss & Partial<AugRule> & Partial<AugJssStyle>>;
const cssImpl = (...declarations: AugJssStyle[]): DataCss | void => {
  // Second layer of caching
  const hash = hashify(declarations);

  // Third layer of caching
  if (hash in cache)
    return cache[hash];

  if (!declarations || _.isEmpty(declarations))
    return;

  const grouped = {
    media   : {} as Partial<JssStyle>,
    supports: {} as Partial<JssStyle>,
    pseudo  : {} as Partial<JssStyle>,
    other   : {} as Partial<JssStyle>,
  } as const;

  for (const [k, v] of _.toPairs(_.merge({}, ...declarations
    .map(d => d.hash ? (cache[d.hash as any] as AugJssStyle).values : d)
    .map(d => Array.isArray(d) ? _.merge(_.flatten(d)) : d)
    .filter(d => !!d))
  )) {
      const selectorType
        = (k.startsWith('@supports' )                        ) ? 'supports'
        : (k.startsWith('@media'    )                        ) ? 'media'
        : (k.startsWith(':'         ) || k.startsWith('&:')  ) ? 'pseudo'
        :                                                        'other';

      Object.assign(grouped[selectorType], {[k]: v});
  }

  // Go through all grouped declarations → { media: { '@media (…)': {} }, pseudo: { ':hover': {}, …}
  // Add them as rule with the same name and return the selector by reducing it
  const rule: AugRule = _.keys(grouped).reduce(
    (selector: any, key: any) => {
      const subDecl = grouped[key as keyof typeof grouped];
      if (!isEmptyObject(subDecl)) {
        const cleanedDecl = cleanup(subDecl);
        return manager.addRule(hash, cleanedDecl);
      }

      return selector;
    },
    {dataSelector: undefined},
  );

  const result: DataCss = { [rule.dataSelector]: '' } as any;

  // Add these properties as non-enumerable so they don't pollute spreading {...css(…)}
  Object.defineProperties(result, {
    toString: { enumerable: false, value: () => rule.classSelector },
    hash: { enumerable: false, value: hash },
    values: { enumerable: false, value: declarations },
  });

  return cache[hash] = result;
};

// First layer of caching
const memoizedCss = memoize(cssImpl);
let animationCount = 0;
const keyframes = (name: Name, declarations: Name | _.Dictionary<AugJssStyle>) => {
  if (typeof name !== 'string') {
    declarations = name;
    name = 'animation';
  }

  const uniqueName = `${name}-${animationCount++}`;
  manager.addRule(`@keyframes ${uniqueName}`, declarations as any);
  return uniqueName;
};

Object.assign(memoizedCss, {keyframes, manager});
const css = memoizedCss as typeof memoizedCss & {keyframes: typeof keyframes, manager: typeof manager};
export { css };
