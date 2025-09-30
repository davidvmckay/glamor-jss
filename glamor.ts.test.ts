import { expect, test, beforeEach, describe } from 'bun:test';
import { css, CssProps, TEST_ACCESS } from './glamor'
const { renderToString, reset, MAX_RULES, Manager, assignNonEnumerable } = TEST_ACCESS;

export const orThrow = (message: Error | string = `Invalid precondition`) => { throw typeof message === 'string' ? new Error(message) : message; };

const assert = (exp: Boolean) => expect(exp).toBeTrue();
type AnyFunc = (...args: any[]) => any;
const assertThrows = <F extends AnyFunc>(fn: F, expectedMessage: string) => {
    let errorMessage = '';
    try {
        css();
        expect(`didNotThrow`).toStrictEqual('UNREACHABLE ASSERTION');
    } catch(err) {
        errorMessage = err.message;
    }
    expect(errorMessage).toStrictEqual(expectedMessage);
};

describe('assignNonEnumerable', () => {
    test('assignNonEnumerable', () => {
        const a = { hello: 'world', nice: 'to meet you' };
        const b = { jk: 'NOT!!!' };
        const target = Object.assign({}, a);
        assert(target !== a);
        assignNonEnumerable(target, b);
        assert((a as any).jk === undefined);
        assert((target as any).jk === 'NOT!!!');
        assert(Object.keys(a).join() === Object.keys(target).join());
        assert(target !== a);
        // console.log({a: `${Object.keys(a)}`, b: `${Object.keys(target)}`});
        // assert(`${a}` !== `${target}`);
    });
});

describe('css', () => {
    beforeEach(reset)

    test('Simple styles', () => {
        const style = css({ width: 100, height: 100 });
        expect(Object.keys(style).length).toStrictEqual(1);
        expect(Object.keys(style.values[0]).length).toStrictEqual(2);
        expect(renderToString()).toMatchSnapshot();
        expect(style?.toString()).not.toBeUndefined();
        expect(Object.keys({ ...style })[0]).toEqual( expect.stringMatching(/^data-css-glamor-/) );
        assertThrows(() => css(), `Arguments for the CSS function should each and all be valid CssProps instances.`);
    });

    test('Keyframes work without collision', () => {
        css.keyframes('fade', { from: { opacity: 0 }, to: { opacity: 1 } });
        css.keyframes('fade', { from: { opacity: 0 }, to: { opacity: 1 } });
        css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
        css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
        expect(renderToString()).toMatchSnapshot();
    });

    test.only('Falsy values', () => {
        css({ width: null, height: undefined, minWidth: false, ':hover': {} }, null as any);
        css([null, {}, []] as any);
        css({ ':after': { width: false && 100, height: 100 } });
        expect(renderToString()).toMatchSnapshot();
    });

    test('Complex styles', () => {
        const bold = css({ fontWeight: 'bold' });
        css(
            { color: 'lightgoldenrodyellow' },
            { height: 150, ':hover': { color: 'khaki' } },
            {
                border: '1px solid mediumaquamarine',
                width: 350,
                borderRadius: '50%',
            },
            { color: 'papayawhip', '@media (min-width: 800px)': { background: 'peachpuff' } },
            { ':hover': { color: 'orchid' } },
            bold
        );

        expect(renderToString()).toMatchSnapshot();
    });

    test('Nested functional styles', () => {
        const activeStyle = {
            color: 'peachpuff',
            ':before': { top: 10 },
        };

        const style = hover => css({
            position: 'relative',
            color: 'gray',
            ':before': {
                position: 'absolute',
                content: `""`,
                top: 0,
            },
            ':hover': hover && activeStyle,
        });

        const styles = toggle => css(style(toggle), toggle && activeStyle);
        expect(styles(true)).toEqual({ 'data-css-13686855474469': '' } as any);
        expect(styles(false)).toEqual({ 'data-css-13921000805328': '' } as any);
        expect(renderToString()).toMatchSnapshot();
    });

    test('Overwrite styles', () => {
        css(
            css({ color: 'mediumaquamarine' }),
            { color: 'peachpuff' },
            css({ color: 'lightcoral' }),
            { color: 'papayawhip' },
            css({ color: 'thistle' })
        );

        expect(renderToString()).toMatchSnapshot();
    });

    test('Multiple styles', () => {
        const props = {
            ...css({ color: 'peachpuff' }),
            ...css({ width: '100vw' }),
        };

        expect(Object.keys(props)).toMatchSnapshot();
    });

    test('Cache styles', () => {
        const complex: CssProps[] = [
            { color: 'lightgoldenrodyellow' },
            { height: 150, ':hover': { color: 'khaki' } },
            {
                border: '1px solid mediumaquamarine',
                width: 350,
                borderRadius: '50%',
            },
            {
                color: 'papayawhip',
                '@media (min-width: 800px)': { background: 'peachpuff' },
            },
        ];

        expect(css({ color: 'red' })).toBe(css({ color: 'red' }));
        expect(css({ width: y => y + 1 })).toEqual(css({ width: y => y + 1 }));
        expect(css(...complex)).toBe(css(...complex));
    });

    test('Max rules', () => {
        const man = new Manager();
        man.rulesCount = MAX_RULES - 1;
        man.addRule('test', { color: 'red' });

        expect(man.registry.registry).toHaveLength(2);
    });
});
