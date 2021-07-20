import * as _ from 'lodash';
import * as jssModule from 'jss';
// import StyleRule from 'jss/lib/rules/StyleRule';
// import { create, BypassStyleRule, SheetsRegistry } from 'jss';
import type { Rule, StyleSheet, JssStyle }  from 'jss';
import preset from 'jss-preset-default';
import hashify from 'hash-it';
import { memoize, cleanup, customIsFalsy, customIsObject } from './memoize';
import { MyStyleRule } from './MyStyleRule';

type Name = string | number | symbol;
const IS_DEV = process.env.NODE_ENV !== 'production';
const MAX_RULES = 65534;
const jss = jssModule.create(preset());
jss.use({
  /** render data-x selectors in addition to classNames (like glamor) */
  onProcessRule: (rule: MyStyleRule) => {
    if (rule.type === 'style' && !rule.options?.parent?.type && !/\[data-css-.+\]/.test(rule.selectorText)) {
      rule.originalSelectorText = rule.selectorText;
      rule.classSelector = rule.selectorText.substring(1);
      rule.dataSelector = `data-${rule.classSelector}`; // make dataSelector available for application in React code (or raw html as desired)
      rule.selectorText = `${rule.selectorText}, [${rule.dataSelector}]`; // this is how the style rule actually matches (selctor written into css) -- selector property getter forwards to selectorText field
    }

    return rule;
  },

  /** Replace :hover with &:hover, etc. */
  onCreateRule: (name: any, decl: any, options: any): any => {
    if (decl == null && typeof name !== 'string') {
      decl = name;
      name = undefined;
    }

    Object.keys(decl).forEach(key => {
      const k = key.trim();
      if (key.indexOf(':') === 0 || key.indexOf('>') === 0) {
        decl[`&${k}`] = { ...decl[key] };
        delete decl[key];
      }
    });

    // return new StyleRule(name, decl, options)
    return new MyStyleRule(name, decl, options);
  },
});

type ManagerOptions = {
  sheetPrefix: string,
  classNamePrefix: string,
};

class Manager {
  #registry = new jssModule.SheetsRegistry();
  #currentSheet = null as null | StyleSheet;
  #rulesCount = 0;
  #sheetCount = 0;
  #options = {} as ManagerOptions;
  constructor(options?: ManagerOptions) {
    this.#options = { sheetPrefix: 'glamor-jss', classNamePrefix: 'css', ...options };
  }

  reset = () => { this.#registry.reset(); this.#currentSheet = null; };
  createSheet = () => {
    const sheet = jss.createStyleSheet(null, {
      generateId: rule => `${this.#options.classNamePrefix}-${rule.key}`,
      meta: `${this.#options.sheetPrefix}-${this.#sheetCount++}`,
    });

    this.#registry.add(sheet);
    return sheet;
  };

  renderToString = () => this.#registry.toString();
  getSheet = () => this.#currentSheet ?? (this.#currentSheet = this.createSheet());
  addRule = (hash: Name, declarations: JssStyle, options?: Partial<any/*RuleOptions*/>) => {
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
  if (hash in cache) return cache[hash];
  if (customIsFalsy(declarations)) return;

  const grouped = {
    media   : {} as Partial<JssStyle>,
    supports: {} as Partial<JssStyle>,
    pseudo  : {} as Partial<JssStyle>,
    other   : {} as Partial<JssStyle>,
  } as const;

  /* Last occurrence of a key in any of the objects in the supplied array... wins. */
  const customMergeLatest = arr => arr.reduce((prev, curr) => ({ ...prev, ...curr }), {});

  const customFlatten = arr => Array.prototype.concat(...arr);

  /**preserves arrays.  unsure if _.merge does the same. */
  const customMergeDeep = (...objects: any[]) =>
    objects.reduce((prev, curr) => {
      Object.keys(curr).forEach(key => {
        const prevVal = prev[key];
        const currVal = curr[key];
        if (Array.isArray(prevVal) && Array.isArray(currVal))
          prev[key] = prevVal.concat(...currVal);
        else if (customIsObject(prevVal) && customIsObject(currVal))
          prev[key] = customMergeDeep(prevVal, currVal);
        else
          prev[key] = currVal;
      });

      return prev;
    }, {});

  for (const [k, v] of _.toPairs(customMergeDeep(...declarations
    .map(d => (d && d.hash ? cache[d.hash].values : d))
    // .map(d => (cache[d.hash as any] as AugJssStyle)?.values ?? d)
    .map(d => Array.isArray(d) ? customMergeLatest(customFlatten(d)) : d)
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
      return _.isEmpty(subDecl) ? selector : manager.addRule(hash, cleanup(subDecl));
    },
    '',
    // {dataSelector: undefined},
  );

  const result: DataCss = {} as any;

  // Add these properties as non-enumerable so they don't pollute spreading {...css(…)}
  Object.defineProperties(result, {
     toString          : { enumerable: false, value: () => rule.classSelector },
     hash              : { enumerable: false, value: hash                     },
     values            : { enumerable: false, value: declarations             },
    [rule.dataSelector]: { enumerable: true , value: ''                       },
  });

  cache[hash] = result;
  return result;
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

Object.assign(memoizedCss, {keyframes, renderToString: manager.renderToString});
export const css = memoizedCss as typeof memoizedCss & {keyframes: typeof keyframes, renderToString: typeof manager.renderToString};
export default css;
