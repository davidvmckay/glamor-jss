import * as _ from 'lodash';
import type { JssStyle }  from 'jss';

export const cleanup = (declarations: JssStyle | _.Dictionary<JssStyle>) => {
  for (const key of _.keys(declarations) as Array<keyof typeof declarations>) {
    if (_.isObject(declarations[key]))
      cleanup(declarations[key] as any); // recusion

    if (!declarations[key] || _.isEmpty(declarations[key]))
      delete declarations[key];
  }

  return declarations;
};

export const isEmptyObject = (obj: any) => _.isObject(obj) && _.isEmpty(obj);

const isPrimitive = <T>(value: T) => ((typeof value !== 'object') && (typeof value !== 'function')) || (value === null);

class MapTree {
  childBranches = new WeakMap();
  primitiveKeys = new Map();
  hasValue = false;
  value: any = undefined;
  has = (key: unknown) => {
    var keyObject = (isPrimitive(key) ? this.primitiveKeys.get(key) : key);
    return (keyObject ? this.childBranches.has(keyObject) : false);
  };

  get = (key: unknown) => {
    var keyObject = (isPrimitive(key) ? this.primitiveKeys.get(key) : key);
    return (keyObject ? this.childBranches.get(keyObject) : undefined);
  };

  resolveBranch = (key: unknown) => {
    if (this.has(key)) { return this.get(key); }
    var newBranch = new MapTree();
    var keyObject = this.createKey(key) as any;
    this.childBranches.set(keyObject, newBranch);
    return newBranch;
  };

  setValue = (value: unknown) => {
    this.hasValue = true;
    return (this.value = value);
  };

  createKey = (key: unknown) => {
    if (isPrimitive(key)) {
      var keyObject = {};
      this.primitiveKeys.set(key, keyObject);
      return keyObject;
    }

    return key;
  };

  clear = (...args: unknown[]) => {
    if (args.length === 0) {
      this.childBranches = new WeakMap();
      this.primitiveKeys.clear();
      this.hasValue = false;
      this.value = undefined;
    } else if (args.length === 1) {
      var key = args[0];
      if (isPrimitive(key)) {
        var keyObject = this.primitiveKeys.get(key);
        if (keyObject) {
          this.childBranches.delete(keyObject);
          this.primitiveKeys.delete(key);
        }
      } else {
        this.childBranches.delete(key as any);
      }
    } else {
      var childKey = args[0];
      if (this.has(childKey)) {
        var childBranch = this.get(childKey);
        childBranch.clear.apply(childBranch, Array.prototype.slice.call(args, 1));
      }
    }
  };
}

type AnyFn = (...fnArgs: any[]) => any;
export const memoize = <F extends AnyFn>(fn: F) => {
  var argsTree = new MapTree();
  function memoized() {
    var args = Array.prototype.slice.call(arguments);
    var argNode = args.reduce(function getBranch(parentBranch, arg) {
      return parentBranch.resolveBranch(arg);
    }, argsTree);
    if (argNode.hasValue) { return argNode.value; }
    var value = fn.apply(null, args);
    return argNode.setValue(value);
  }

  memoized.clear = argsTree.clear.bind(argsTree);
  return memoized as any as F;
};
