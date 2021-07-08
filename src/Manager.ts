import type { Rule, StyleSheet, JssStyle }  from 'jss';
import { SheetsRegistry } from 'jss';
import { jss } from './index';

type Name = string | number | symbol;
const IS_DEV = process.env.NODE_ENV !== 'production';
export const MAX_RULES = 65534;
type ManagerOptions = {
  sheetPrefix: string,
  classNamePrefix: string,
};

export default class Manager {
  #registry = new SheetsRegistry();
  #currentSheet = null as null | StyleSheet;
  #rulesCount = 0;
  #sheetCount = 0;
  #options = {} as ManagerOptions;
  constructor(options?: ManagerOptions) { this.#options = { sheetPrefix: 'glamor-jss', classNamePrefix: 'css', ...options }; }
  public reset = () => { this.#registry.reset(); this.#currentSheet = null; };
  public createSheet = () => {
    const sheet = jss.createStyleSheet(null, {
      generateId: rule => `${this.#options.classNamePrefix}-${rule.key}`,
      meta: `${this.#options.sheetPrefix}-${this.#sheetCount++}`,
    });
    this.#registry.add(sheet);
    return sheet;
  };

  public renderToString = () => this.#registry.toString();
  public getSheet = () => this.#currentSheet ?? (this.#currentSheet = this.createSheet());
  public addRule = (hash: Name, declarations: JssStyle, options) => {
    const sheet = this.getSheet();

    // Detatch and attach again to make Chrome Dev Tools working
    // Similar to `speedy` from glamor: https://github.com/threepointone/glamor#speedy-mode
    if (IS_DEV) sheet.detach();
    const rule = sheet.addRule(hash, declarations, options);
    // https://blogs.msdn.microsoft.com/ieinternals/2011/05/14/stylesheet-limits-in-internet-explorer/
    if (++this.#rulesCount % MAX_RULES === 0)
      this.#currentSheet = this.createSheet();

    if (IS_DEV) sheet.attach();
    return rule;
  };
}
