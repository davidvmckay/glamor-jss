import { SheetsRegistry, create, createRule } from 'jss';
import type { StyleSheet, Rule, JssStyle } from 'jss';
import preset from 'jss-preset-default';
import hashify from 'hash-it';
import { memoize } from './memoize-weak';
import type * as CSS from 'csstype';
export type * as CSS from 'csstype'
export * as JssCore from 'jss';
import * as Z from 'zod';
import * as _ from 'lodash';
export const DefaultPreset = preset;

export const hash = hashify;


//  ====================
//  TYPES
//  --------------------

type Obj = {[K: string]: unknown};
/** Object.assing, except the enumerable properties of b are assigned to a as non-enumerable, via Object.defineProperties(...) */
const assignNonEnumerable = <A extends Obj, B extends Obj>(a: A, b: B) => {
    const bb = {} as any;
    for (const k of Object.keys(b)) {
        bb[k] = {enumerable: false, value: b[k]};
    }
    Object.defineProperties(a, bb);
    return a as A & B;
};

/** Convert an intersection to an object, e.g. {a: 1} & {a: 2, b: 3} => {a: 1 & 2, b: 3} */
type Collapse<T> = T extends object ? { [K in keyof T]: T[K] } : T;

// JSSStyle is very like CSS.Properties, except that it permits arrays and other value types that JSS plugins transfrom to css strings.
type StyleProps = Collapse<Partial<JssStyle | CSS.Properties>>;
type NestedStye = {[Selector: string]: StyleProps | undefined};
// export type CssProps = StyleProps & {[Selector: string]: CssProps | undefined};
export type CssProps = Collapse<StyleProps | NestedStye>;
// const CssDeclaration = Z.object({
//     toString: Z.function(Z.tuple([]), Z.string()),
//     hash: Z.number(),
//     values: Z.array(Z.custom<Declaration>()),
// }).catchall(Z.string()); // DVM 2025 01 19 - not sure how to validate that OTHER keys start with `dta-css-glamor-`
export type Declaration = CssProps & {hash?: number};
export type Declarations = Declaration[];
const CssAttachableSchema = Z.object({
    toString: Z.function(Z.tuple([]), Z.string()),
    hash: Z.number(),
    values: Z.array(Z.custom<Declaration>()),
}).catchall(Z.string()); // DVM 2025 01 19 - not sure how to validate that OTHER keys start with `dta-css-glamor-`
export type CssAttachable = Z.infer<typeof CssAttachableSchema>;
export type CssCache = { [K: number]: CssAttachable };
type Arg3<F> = F extends ((a: any, b: any, c: infer Third, ...z: any) => any) ? Third : never;
export type RuleOptions = Arg3<typeof createRule>;
export type RuleAugmentation = {
    originalSelectorText?: string,
    classSelector?: string,
    dataSelector?: string,
    selectorText?: string,
};
export type PsuedoSelector = string;


//  ====================
//  UTILS
//  --------------------

const isObject = (val: unknown): val is Obj => Object.prototype.toString.call(val) === '[object Object]';
const isDeclaration = (val: unknown): val is Declaration => isObject(val);
const flatten = <A extends unknown[]>(arr: A) => Array.prototype.concat(...arr);
const mergeValues = (arr: Obj[]) => arr.reduce((prev, curr) => ({ ...prev, ...curr }), {});
const mergeDeep = (...objects: Obj[]) => objects.reduce((prev, curr) => {
    Object.keys(curr).forEach((key: keyof typeof curr) => {
        const prevVal = prev[key];
        const currVal = curr[key];
        if (Array.isArray(prevVal) && Array.isArray(currVal))
            prev[key] = prevVal.concat(...currVal);
        else if (isObject(prevVal) && isObject(currVal))
            prev[key] = mergeDeep(prevVal, currVal);
        else
            prev[key] = currVal;
    })

    return prev;
}, {});

/** Is it definitely an object, and also an object with zero enumerable keys? */
export const isEmptyObject = (obj: Obj) => {
    if (typeof obj !== 'object') return false;
    for (const _ in obj) return false;
    return true;
}

/** Specialized notion of falsyness that includes objects with zero enumerable keys -- but EXCLUDES falsy numbers. */
export const isFalsy = (value: any) =>
    value === null ||
    value === undefined ||
    value === false ||
    isEmptyObject(value);

/** Deletes falsy values from Declarations recursively. */
export const cleanup = (decl: Declaration) => {
    for (const k in Object.keys(decl)) {
        // TODO: validate these casts?
        if (isFalsy(decl[k as keyof Declaration])) {
            delete decl[k as keyof Declaration];
            continue;
        }

        if (isDeclaration((decl as NestedStye)[k]))
            cleanup((decl as NestedStye)[k]!);
    }

    return decl;
};

export const groupByType = (obj: Obj) => Object.keys(obj).reduce(
    (prev, curr) => {
        let key: keyof typeof prev = 'other';
        if (curr.indexOf('@supports') === 0) key = 'supports';
        else if (curr.indexOf('@media') === 0) key = 'media';
        else if (curr.indexOf(':') === 0 || curr.indexOf('&:') === 0)
            key = 'pseudo';

        prev[key][curr] = obj[curr as keyof typeof obj];
        return prev;
    },
    { media: {} as Obj, supports: {} as Obj, pseudo: {} as Obj, other: {} as Obj } as const
);


/**
 * This pulls out previous declared declarations,
 * flattens them, combines the values by taking the latest (mergeValues),
 * filters out falsy values and groups them in to @media/@support/pseudos and others
 * to give them precendence in the stylesheet
 */
export const processDeclarations = (declarations: Array<CssAttachable | Declaration>, cache: CssCache) => {
    const flattened = declarations
        .map(d => (d?.hash ? cache[d.hash].values : d))
        .map(d => (Array.isArray(d) ? mergeValues(flatten(d as Declarations)) : d))
        .filter(Boolean);

    const merged = mergeDeep(...flattened);
    return groupByType(merged);
};


//  ====================
//  NORMALIZE-SELECTOR
//  --------------------

const NormalizePseudoSelectorPlugin = {
    onCreateRule: (name: string | Declaration, decl: Declaration, options?: RuleOptions & {__onCreateRule_EXECUTED__?: {rule: Rule}}) => {
        if (isObject(options?.__onCreateRule_EXECUTED__))
            return options!.__onCreateRule_EXECUTED__.rule as Rule;

        if (isDeclaration(name)) {
            const oDec = decl;
            decl = Object.assign(decl ?? {}, name);
            name = `glamor-${hashify(decl)}`;
            console.warn(`name was an object, renamed to ${name}; original decl was '${JSON.stringify(oDec, null, 4)}'`);
            // name = undefined as any; // super weird!!!!!!!!!!!!!!!!!!!!  -- I lack knowledge of JSS internals to know why this was done
        } else if (typeof name === 'number' /*i.e. a hash*/)
            name = `glamor-${name}`;

        // special re-formatting for nested declarations; supports pseudo selectors and (some) complex selector expressions
        Object.keys(decl!).forEach(key => {
            key = key.trim();
            if (key.indexOf(':') === 0 || key.indexOf('>') === 0) {
                const nestedDecl = decl as NestedStye;
                (nestedDecl!)[`&${key}`] = { ...((nestedDecl!)[key]||{}) };
                delete (nestedDecl!)[key];
            }
        });

        const bloop = {rule: undefined as Rule | undefined};
        if (typeof name !== 'string')
            console.warn(`attempting to create css rule without a name: ${name} decl: ${decl} opts: ${options}`);

        bloop.rule = createRule(name as any, decl! as JssStyle, Object.assign({} as RuleOptions, options ?? {}, {__onCreateRule_EXECUTED__: bloop}));
        return bloop.rule;
    },
};


//  ====================
//  DATA-SELECTOR
//  --------------------

const isDataSelector = (name: string) => /\[data-css-.+\]/.test(name);
export const DataSelectorPlugin = {
    onProcessRule: (rule: Rule & RuleAugmentation) => {
        const { selectorText, type, options: { parent } } = rule;
        if (type === 'style' && !(parent as Rule).type && !isDataSelector(selectorText??'')) {
            // MOTE: individual assignments instead of Object.assign.... probably due to setters.
            rule.originalSelectorText = selectorText;
            rule.classSelector = selectorText?.substring(1)??'';
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
// const IS_DEV = process?.env.NODE_ENV !== 'production';
const IS_DEV = false;
export const MAX_RULES = 65534;
export class Manager {
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

    addRule = (hash: number | PsuedoSelector, declaration: Declaration, options: Partial<RuleOptions> = {}) => {
        const sheet = this.getSheet();

        // Detatch and attach again to make Chrome Dev Tools working
        // Similar to `speedy` from glamor: https://github.com/threepointone/glamor#speedy-mode
        if (IS_DEV) sheet.detach();
        console.log(hash, declaration, options)
        const rule = sheet.addRule(hash, declaration as JssStyle, options);
        // https://blogs.msdn.microsoft.com/ieinternals/2011/05/14/stylesheet-limits-in-internet-explorer/
        if (++this.rulesCount % MAX_RULES === 0) // DVM 2025 01 22 - I think this leaks style sheets, can caus interference for dynamic styles, and doesnt completely solve the issue.  Need to track all the sheets that have been created and know what style is on what sheet. jss internals deep-dive required.
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
const cache = {} as CssCache;

// render data selectors instead of classNames (like glamor)
jss.use(DataSelectorPlugin);

// Replace :hover with &:hover, etc.
jss.use(NormalizePseudoSelectorPlugin);

function cssImpl(...declarations: Array<CssAttachable | Declaration>): CssAttachable {
    const decls = _.compact(_.flatten(declarations as any)) as Array<CssAttachable | Declaration>; // include type in arg definition to cssImpl to hint consumers what to pass - but in reality, support a bunch of whacky legacy usages, defensively.
    if (!decls?.length || !decls.every(x => CssAttachableSchema.safeParse(x) || CssAttachableSchema.safeParse(x)))
        throw new Error(`Arguments for the CSS function should each and all be valid CssProps instances.`);

    // Second layer of caching
    const hash = hashify(decls);

    // Third layer of caching
    if (hash in cache) return cache[hash];

    const grouped = processDeclarations(decls, cache);

    // Go through all grouped declarations → { media: { '@media (…)': {} }, pseudo: { ':hover': {}, …}
    // Add them as rule with the same name and return the selector by reducing it
    const rule = (['other', 'pseudo', 'media', 'supports'] as const).reduce(
        (selector, key) => {
            const subDecl = grouped[key];
            if (!isEmptyObject(subDecl) && isDeclaration(subDecl)) {
                const cleanedDecl = cleanup(subDecl);
                console.log(cleanedDecl)
                const pseudo = _.keys(cleanedDecl).length === 1 && _.keys(cleanedDecl)[0].startsWith(':') ? _.keys(cleanedDecl)[0] : undefined;
                return manager.addRule(pseudo ?? hash, cleanedDecl);
            }

            return selector as any & Rule;
        },
        ''
    ) as any as Rule & RuleAugmentation;

    // console.log(rule.dataSelector)
    // console.log(assignNonEnumerable(
    //     { [rule.dataSelector!]: '' },
    //     // Add these properties as non-enumerable so they don't pollute spreading {...css(…)}
    //     {
    //         toString: () => rule.classSelector ?? '∫--undefined classSelector--∫',
    //         hash    : hash,
    //         values  : declarations,
    //     },
    // ))
    cache[hash] = assignNonEnumerable(
        { [rule.dataSelector!]: '' }, // WHAT was this for?  empty string????
        // Add these properties as non-enumerable so they don't pollute spreading {...css(…)}
        {
            toString: () => rule.classSelector ?? '∫--undefined classSelector--∫',
            hash    : hash,
            values  : decls,
        },
    );
    CssAttachableSchema.parse(cache[hash]); // parse to verify schema, BUT DO NOT RETURN PARSED RESULT - want original object reference, with original property metadata like enumerability
    return cache[hash];
}

let animationCount = 0;

// First layer of caching
export const css = Object.assign(
    memoize(cssImpl), // only works if consumers retain the ACTUAL object with declarations - which is rare, often Declarations are inline in a funciton component and not memoized
    {
        keyframes: (name: string | CssProps, declarations: CssProps | undefined = undefined) => {
            if (typeof name !== 'string') {
                declarations = name;
                name = 'animation';
            }

            if (!name?.length)
                name = 'animation';

            declarations ??= {};
            const uniqueName = `${name}-${animationCount++}`;
            manager.addRule(`@keyframes ${uniqueName}`, declarations);
            return uniqueName;
        }
    },
    jss,
    // as { SheetsRegistry, create, createRule, StyleSheet, Rule, JssStyle };
    DefaultPreset
);

export const TEST_ACCESS = {
    renderToString,
    reset,
    Manager,
    MAX_RULES,
    assignNonEnumerable,
};
