import {getter} from "../cache";
import {addExtensions} from "../extensions/allExtensions";
import {Test} from "../functional/Test";
import {identity} from "../functional/utils";
import {fnv1a} from "../hash/fnv1a";
import {regex} from "../regex";
import {isNumber, isString} from "../types/isType";

export type HashValue = number | string;

export interface Hash<T, H = HashValue> {
    
    (t: T): H;
    
}

export interface Equals<T> {
    
    (t1: T, t2: T): boolean;
    
}

export interface HashEquals<T, H = HashValue> {
    
    readonly hash: Hash<T, H>;
    readonly equals: Equals<T>;
    
}

export interface HashEqualable<T, H = HashValue> {
    
    equals(this: T, other: T): boolean;
    
    hash(): H;
    
}

// cache to make them singletons

export interface EqualsClass {
    
    bind<T>(equals: Equals<T>, t: T): (t: T) => boolean;
    
    default<T>(): Equals<T>;
    
    referential<T>(): Equals<T>;
    
    fastEquals<T>(equals: Equals<T>): Equals<T>;
    
}

const isReferentialEqualitySource = ((): Test<string> => {
    const twoArgs = /\(([^\s,]*)\s*,\s*([^\s)]*)\)/;
    const equality = /\s*\1\s*===\s*\2/;
    const functionBody = regex.join(/\s*{\s*return/, equality, /\s*;\s*}/);
    const func = regex.join(/function\s*/, twoArgs, functionBody);
    const arrow = /\s*=>/;
    const arrowFuncWithBody = regex.join(twoArgs, arrow, functionBody);
    const arrowFunc = regex.join(twoArgs, arrow, equality);
    return s => [arrowFunc, arrowFuncWithBody, func].some(regex => regex.test(s));
})();

export const Equals: EqualsClass = {
    
    bind: <T>(equals: Equals<T>, t: T): (t: T) => boolean => {
        return _t => equals(t, _t);
    },
    
    default: getter(<T>(t1: T, t2: T) => Equals.referential()(t1, t2) || Hash.default()(t1) === Hash.default()(t2)),
    
    referential: () => Object.is,
    
    fastEquals: <T>(equals: Equals<T>) => {
        // means equals is using referential equality, don't repeat
        // double checking referential equality is cheap except for strings
        const referential = Equals.referential();
        if (equals === referential || isReferentialEqualitySource(equals.toString())) {
            return referential;
        }
        return (t1: T, t2: T) => t1 === t2 || equals(t1, t2);
    },
    
};

export interface HashClass {
    
    makeNumber<H>(hash: H): number;
    
    default<T, H = string>(): Hash<T, H>;
    
    referential<T>(): Hash<T, T>;
    
}

export const Hash: HashClass = {
    
    makeNumber<H>(hash: H): number {
        return isNumber(hash) ? hash : fnv1a(isString(hash) ? hash : Hash.default()(hash));
    },
    
    // TODO maybe fix type assertion
    default: () => JSON.stringify as Hash<any, any>,
    
    referential: () => identity,
    
};

export interface HashEqualsClass {
    
    default<T, H = string>(): HashEquals<T, H>;
    
    referential<T>(): HashEquals<T, T>;
    
    isReferential<T, H>(hashEquals: HashEquals<T, H>): boolean;
    
    fastEquals<T, H>(hashEquals: HashEquals<T, H>): HashEquals<T, H>;
    
}

const defaultHashEquals: HashEquals<any, any> = {
    hash: Hash.referential(),
    equals: Equals.referential(),
};

// can't properly type generic constant
// (only functions can be generic, but won't return same value each time)
const referentialHashEquals: HashEquals<any, any> = {
    hash: Hash.referential(),
    equals: Equals.referential(),
};

export const HashEquals: HashEqualsClass = {
    
    default: () => defaultHashEquals,
    
    referential: () => referentialHashEquals,
    
    isReferential: hashEquals => hashEquals === referentialHashEquals,
    
    fastEquals: ({hash, equals}) => ({hash, equals: Equals.fastEquals(equals)}),
    
};