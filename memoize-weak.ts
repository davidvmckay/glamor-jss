const isPrimitive = (value: unknown) => ((typeof value !== 'object') && (typeof value !== 'function')) || (value === null);

class MapTree {
    private childBranches = new WeakMap();
    private primitiveKeys = new Map();
    hasValue = false;
    value = undefined as object | undefined;

    has = (key: object) => {
        const keyObject = (isPrimitive(key) ? this.primitiveKeys.get(key) : key);
        return (keyObject ? this.childBranches.has(keyObject) : false);
    };

    get = (key: object) => {
        const keyObject = (isPrimitive(key) ? this.primitiveKeys.get(key) : key);
        return (keyObject ? this.childBranches.get(keyObject) : undefined);
    };

    resolveBranch = (key: object) => {
        if (this.has(key))
            return this.get(key);

        const newBranch = new MapTree();
        const keyObject = this.createKey(key);
        this.childBranches.set(keyObject, newBranch);
        return newBranch;
    };

    setValue = (value: object) => {
        this.hasValue = true;
        return (this.value = value);
    };

    createKey = (key: object) => {
        if (!isPrimitive(key)) 
            return key;

        const keyObject = {};
        this.primitiveKeys.set(key, keyObject);
        return keyObject;
    };

    clear = (...args: unknown[]) => {
        if (args.length === 0) {
            this.childBranches = new WeakMap();
            this.primitiveKeys.clear();
            this.hasValue = false;
            this.value = undefined;
        } else if (args.length === 1) {
            const key = args[0];
            if (isPrimitive(key)) {
                const keyObject = this.primitiveKeys.get(key);
                if (keyObject) {
                    this.childBranches.delete(keyObject);
                    this.primitiveKeys.delete(key);
                }
            } else {
                this.childBranches.delete(key as object);
            }
        } else {
            const childKey = args[0] as object;
            if (this.has(childKey)) {
                const childBranch = this.get(childKey);
                childBranch.clear.apply(childBranch, Array.prototype.slice.call(args, 1));
            }
        }
    };
}

export const memoize = <FN extends (...args: any[]) => any>(fn: FN) => {
    const argsTree = new MapTree();
    function memoized(...args: object[]) {
        const argNode = args.reduce((parentBranch: MapTree, arg) => parentBranch.resolveBranch(arg), argsTree);
        if (argNode.hasValue)
            return argNode.value;

        return argNode.setValue(fn(args) as any) as ReturnType<FN>;
    }

    memoized.clear = argsTree.clear.bind(argsTree);
    return memoized as FN & {
        /** removes moized function calls (by argument list) */
        clear: MapTree['clear']
    };
};