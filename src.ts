import 'es6-weak-map/implement';
import { SheetsRegistry, create, createRule, StyleSheet, Rule } from 'jss';
import preset from 'jss-preset-default';
import hashify from 'hash-it';
import memoize from 'memoize-weak';
import * as CSS from 'csstype';

interface CSSProperties extends CSS.Properties<string | number> {
    /**
     * The index signature was removed to enable closed typing for style
     * using CSSType. You're able to use type assertion or module augmentation
     * to add properties or an index signature of your own.
     *
     * For examples and more information, visit:
     * https://github.com/frenic/csstype#what-should-i-do-when-i-get-type-errors
     */
}

export type CssProps = CSSProperties | {[Selector: string]: CssProps};

//  ====================
//  UTILS
//  --------------------

const isObject = val => Object.prototype.toString.call(val) === '[object Object]';
const flatten = arr => Array.prototype.concat(...arr);
const mergeValues = arr => arr.reduce((prev, curr) => ({ ...prev, ...curr }), {});
const mergeDeep = (...objects) => objects.reduce((prev, curr) => {
    Object.keys(curr).forEach(key => {
        const prevVal = prev[key]
        const currVal = curr[key]
        if (Array.isArray(prevVal) && Array.isArray(currVal))
            prev[key] = prevVal.concat(...currVal)
        else if (isObject(prevVal) && isObject(currVal))
            prev[key] = mergeDeep(prevVal, currVal)
        else
            prev[key] = currVal
    })

    return prev
}, {});

export const isFalsy = value =>
    value === null ||
    value === undefined ||
    value === false ||
    (typeof value === 'object' && Object.keys(value).length === 0);

export const cleanup = declarations => {
    Object.keys(declarations).forEach(key => {
        if (isObject(declarations[key]))
            cleanup(declarations[key])
        else if (isFalsy(declarations[key]))
            delete declarations[key]
    });

    return declarations;
};

export const isEmptyObject = obj => {
    for (const _ in obj) return false;
    return true;
}

export const groupByType = obj => Object.keys(obj).reduce(
    (prev, curr) => {
        let key = 'other'
        if (curr.indexOf('@supports') === 0) key = 'supports'
        else if (curr.indexOf('@media') === 0) key = 'media'
        else if (curr.indexOf(':') === 0 || curr.indexOf('&:') === 0)
            key = 'pseudo'

        prev[key][curr] = obj[curr]
        return prev
    },
    { media: {}, supports: {}, pseudo: {}, other: {} }
);

/**
 * This pulls out previous declared declarations,
 * flattens them, combines the values by taking the latest (mergeValues),
 * filters out falsy values and groups them in to @media/@support/pseudos and others
 * to give them precendence in the stylesheet
 */
export const processDeclarations = (declarations, cache) => {
    const flattened = declarations
        .map(d => (d && d.hash ? cache[d.hash].values : d))
        .map(d => (Array.isArray(d) ? mergeValues(flatten(d)) : d))
        .filter(Boolean);

    const merged = mergeDeep(...flattened);
    return groupByType(merged);
};


//  ====================
//  NORMALIZE-SELECTOR
//  --------------------

const NormalizePseudoSelectorPlugin = {
    onCreateRule: (name, decl, options) => {
        if (options.__onCreateRule_EXECUTED__) return options.__onCreateRule_EXECUTED__.rule;

        if (decl == null && typeof name !== 'string') {
            decl = name;
            name = undefined;
        }

        Object.keys(decl).forEach(key => {
            key = key.trim();
            if (key.indexOf(':') === 0 || key.indexOf('>') === 0) {
                decl[`&${key}`] = { ...decl[key] };
                delete decl[key];
            }
        });

        const bloop = {rule: undefined as any};
        bloop.rule = createRule(name, decl, Object.assign({}, options, {__onCreateRule_EXECUTED__: bloop}));
        return bloop.rule;
    },
};


//  ====================
//  DATA-SELECTOR
//  --------------------

const isDataSelector = name => /\[data-css-.+\]/.test(name);
export const DataSelectorPlugin = {
    onProcessRule: rule => {
        const { selectorText, type, options: { parent } } = rule;
        if (type === 'style' && !parent.type && !isDataSelector(selectorText)) {
            rule.originalSelectorText = selectorText;
            rule.classSelector = selectorText.substring(1);
            rule.dataSelector = `data-${rule.classSelector}`;
            rule.selectorText = `${selectorText}, [${rule.dataSelector}]`;
        }

        return rule;
    },
};

//  ====================
//  MANAGER
//  --------------------

export const jss = create(preset());
const IS_DEV = process.env.NODE_ENV !== 'production';
export const MAX_RULES = 65534;
export default class Manager {
    registry = new SheetsRegistry();
    currentSheet = null as null | StyleSheet<string | number | symbol>;
    rulesCount = 0;
    sheetCount = 0;
    options = {
        sheetPrefix: 'glamor-jss',
        classNamePrefix: 'css',
    };
    constructor(options = {}) {
        this.options = {
            sheetPrefix: 'glamor-jss',
            classNamePrefix: 'css',
            ...options,
        };
    }

    reset = () => {
        this.registry.reset();
        this.currentSheet = null;
    };

    createSheet = () => {
        const { sheetPrefix } = this.options;
        const sheet = jss.createStyleSheet({}, {
            generateId: rule => `${this.options.classNamePrefix}-${rule.key}`,
            meta: `${sheetPrefix}-${this.sheetCount++}`,
        }) as StyleSheet<string | number | symbol>;
        this.registry.add(sheet);
        sheet.attach();
        return sheet;
    };

    getSheet = () => {
        if (!this.currentSheet)
            this.currentSheet = this.createSheet();

        return this.currentSheet;
    };

    addRule = (hash, declarations, options = {}) => {
        const sheet = this.getSheet();

        // Detatch and attach again to make Chrome Dev Tools working
        // Similar to `speedy` from glamor: https://github.com/threepointone/glamor#speedy-mode
        if (IS_DEV) sheet.detach();
        const rule = sheet.addRule(hash, declarations, options);
        // https://blogs.msdn.microsoft.com/ieinternals/2011/05/14/stylesheet-limits-in-internet-explorer/
        if (++this.rulesCount % MAX_RULES === 0)
            this.currentSheet = this.createSheet();

        if (IS_DEV) sheet.attach();
        return rule;
    };
}

//  ====================
//  INDEX
//  --------------------

const manager = new Manager();
export const renderToString = () => manager.registry.toString();
export const reset = () => manager.reset();
// export const jss = create(preset()); moved into MANAGER section
export const getSheet = () => manager.getSheet();
const cache = {} as {[K: string]: {[X: number]: string}};

// render data selectors instead of classNames (like glamor)
jss.use(DataSelectorPlugin);

// Replace :hover with &:hover, etc.
jss.use(NormalizePseudoSelectorPlugin);

function cssImpl(...declarations: CssProps[]) {
    // Second layer of caching
    const hash = hashify(declarations);

    // Third layer of caching
    if (hash in cache) return cache[hash];

    if (isFalsy(declarations)) return;
    const grouped = processDeclarations(declarations, cache);

    // Go through all grouped declarations → { media: { '@media (…)': {} }, pseudo: { ':hover': {}, …}
    // Add them as rule with the same name and return the selector by reducing it
    const rule = (['other', 'pseudo', 'media', 'supports'] as const).reduce(
        (selector, key) => {
            const subDecl = grouped[key];
            if (!isEmptyObject(subDecl)) {
                const cleanedDecl = cleanup(subDecl);
                return manager.addRule(hash, cleanedDecl);
            }

            return selector as any & Rule;
        },
        ''
    ) as any & Rule;

    const result = { [rule.dataSelector]: '' };

    // Add these properties as non-enumerable so they don't pollute spreading {...css(…)}
    Object.defineProperties(result, {
        toString: {
            enumerable: false,
            value: () => rule.classSelector,
        },
        hash: {
            enumerable: false,
            value: hash,
        },
        values: {
            enumerable: false,
            value: declarations,
        },
    });

    cache[hash] = result;
    return result;
}

let animationCount = 0;

// First layer of caching
export const css = Object.assign(
    memoize(cssImpl) as typeof cssImpl,
    {
        keyframes: (name: string, declarations: CssProps) => {
            if (typeof name !== 'string') {
                declarations = name;
                name = 'animation';
            }
        
            const uniqueName = `${name}-${animationCount++}`;
            manager.addRule(`@keyframes ${uniqueName}`, declarations);
            return uniqueName;
        }
    }
);
