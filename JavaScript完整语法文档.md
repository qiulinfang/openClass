# JavaScript 完整语法文档

> 涵盖 ES5 → ES2024 全版本语法，适合速查与学习参考。

---

## 目录

1. [基础概念](#1-基础概念)
2. [变量与声明](#2-变量与声明)
3. [数据类型](#3-数据类型)
4. [运算符](#4-运算符)
5. [控制流](#5-控制流)
6. [函数](#6-函数)
7. [对象](#7-对象)
8. [数组](#8-数组)
9. [解构赋值](#9-解构赋值)
10. [展开与剩余运算符](#10-展开与剩余运算符)
11. [类（Class）](#11-类class)
12. [模块（Module）](#12-模块module)
13. [Promise 与异步](#13-promise-与异步)
14. [迭代器与生成器](#14-迭代器与生成器)
15. [Symbol](#15-symbol)
16. [Map / Set / WeakMap / WeakSet](#16-map--set--weakmap--weakset)
17. [Proxy 与 Reflect](#17-proxy-与-reflect)
18. [错误处理](#18-错误处理)
19. [正则表达式](#19-正则表达式)
20. [内置对象速查](#20-内置对象速查)
21. [ES2020–2024 新特性](#21-es20202024-新特性)

---

## 1. 基础概念

### 1.1 注释

```js
// 单行注释

/*
  多行注释
*/

/** JSDoc 注释（用于文档生成）
 * @param {string} name
 * @returns {string}
 */
```

### 1.2 严格模式

```js
'use strict'; // 文件或函数顶部声明

function foo() {
  'use strict';
  // 启用严格模式
}
```

### 1.3 分号规则

JavaScript 具有 **自动分号插入（ASI）** 机制，但建议显式加分号，避免以下情况出错：

```js
// 危险示例：不加分号
const a = 1
[1, 2].forEach(console.log) // 被解析为 a[1,2].forEach(...)
```

---

## 2. 变量与声明

### 2.1 三种声明方式

| 关键字 | 作用域 | 提升 | 重复声明 | 可重新赋值 |
|--------|--------|------|----------|-----------|
| `var`  | 函数/全局 | ✅（值为 undefined） | ✅ | ✅ |
| `let`  | 块级 | ❌（暂时性死区） | ❌ | ✅ |
| `const` | 块级 | ❌（暂时性死区） | ❌ | ❌ |

```js
var x = 1;
let y = 2;
const Z = 3;

// var 提升示例
console.log(a); // undefined（不报错）
var a = 10;

// let 暂时性死区（TDZ）
console.log(b); // ReferenceError
let b = 10;
```

### 2.2 变量命名规则

```js
// 合法标识符
let myVar, _private, $el, 变量名, MAX_SIZE;

// 非法
// let 1abc;   数字开头
// let my-var; 含连字符
// let class;  保留字
```

---

## 3. 数据类型

### 3.1 原始类型（Primitive）

```js
// Number
let n = 42;
let f = 3.14;
let hex = 0xFF;
let bin = 0b1010;
let oct = 0o17;
let sci = 1.5e3;      // 1500
let inf = Infinity;
let nan = NaN;

// BigInt（ES2020）
let big = 9007199254740991n;
let bigCalc = 100n + 200n;

// String
let s1 = 'hello';
let s2 = "world";
let s3 = `模板字符串 ${s1}`; // ES6 模板字面量

// 多行字符串
let multi = `第一行
第二行`;

// Boolean
let t = true;
let fa = false;

// Undefined
let u;
console.log(u); // undefined

// Null
let empty = null;

// Symbol（ES6）
let sym = Symbol('描述');
let sym2 = Symbol.for('全局注册');

// 类型检测
typeof 42           // "number"
typeof "str"        // "string"
typeof true         // "boolean"
typeof undefined    // "undefined"
typeof null         // "object"  ← 历史遗留 bug
typeof Symbol()     // "symbol"
typeof {}           // "object"
typeof []           // "object"
typeof function(){} // "function"
typeof 42n          // "bigint"
```

### 3.2 引用类型（Reference）

```js
// Object
let obj = { key: 'value' };

// Array
let arr = [1, 2, 3];

// Function
let fn = function() {};

// Date / RegExp / Map / Set / Promise...
```

### 3.3 类型转换

```js
// 显式转换
Number("42")      // 42
Number(true)      // 1
Number(null)      // 0
Number(undefined) // NaN
Number("")        // 0

String(42)        // "42"
String(null)      // "null"

Boolean(0)        // false
Boolean("")       // false
Boolean(null)     // false
Boolean(undefined)// false
Boolean(NaN)      // false
Boolean(false)    // false
// 以上为 falsy 值，其余均为 true

parseInt("42.9")  // 42
parseFloat("3.14")// 3.14
parseInt("0xFF", 16) // 255

// 隐式转换
"5" + 3     // "53"（字符串拼接）
"5" - 3     // 2   （数字运算）
"5" * "2"   // 10
true + 1    // 2
null + 1    // 1
undefined + 1 // NaN
```

---

## 4. 运算符

### 4.1 算术运算符

```js
5 + 2   // 7
5 - 2   // 3
5 * 2   // 10
5 / 2   // 2.5
5 % 2   // 1（取余）
5 ** 2  // 25（幂，ES2016）
++x     // 前置自增（先加后用）
x++     // 后置自增（先用后加）
--x     // 前置自减
x--     // 后置自减
```

### 4.2 赋值运算符

```js
let x = 10;
x += 5;   // x = x + 5  → 15
x -= 3;   // x = x - 3  → 12
x *= 2;   // x = x * 2  → 24
x /= 4;   // x = x / 4  → 6
x %= 4;   // x = x % 4  → 2
x **= 3;  // x = x ** 3 → 8

// 逻辑赋值（ES2021）
x &&= 5;  // x && (x = 5)
x ||= 5;  // x || (x = 5)
x ??= 5;  // x ?? (x = 5)
```

### 4.3 比较运算符

```js
// 宽松比较（会类型转换）
5 == "5"    // true
null == undefined // true
0 == false  // true

// 严格比较（不做类型转换，推荐使用）
5 === "5"   // false
5 === 5     // true
null === undefined // false

!=   // 不等（宽松）
!==  // 不等（严格，推荐）
>  < >= <=  // 比较
```

### 4.4 逻辑运算符

```js
true && false   // false（与）
true || false   // true （或）
!true           // false（非）

// 短路求值
null && "hello"        // null（左侧 falsy，直接返回）
"hello" && "world"     // "world"
undefined || "default" // "default"
"value" || "default"   // "value"

// 空值合并（ES2020）—— 仅 null/undefined 时取右值
null ?? "default"      // "default"
0 ?? "default"         // 0  （0 不是 null/undefined）
"" ?? "default"        // ""

// 可选链（ES2020）
obj?.prop
obj?.method?.()
arr?.[0]
```

### 4.5 位运算符

```js
5 & 3   // 1  （按位与）
5 | 3   // 7  （按位或）
5 ^ 3   // 6  （按位异或）
~5      // -6 （按位非）
5 << 1  // 10 （左移）
5 >> 1  // 2  （有符号右移）
5 >>> 1 // 2  （无符号右移）
```

### 4.6 其他运算符

```js
// 三元运算符
let result = condition ? '是' : '否';

// typeof
typeof "hello"  // "string"

// instanceof
[] instanceof Array   // true
{} instanceof Object  // true

// in（检查属性）
'name' in { name: 'Alice' }  // true

// void
void 0  // undefined

// delete
let o = { a: 1 };
delete o.a;  // true

// 逗号运算符（返回最后一个表达式）
let x = (1, 2, 3);  // x = 3
```

---

## 5. 控制流

### 5.1 条件语句

```js
// if / else if / else
if (score >= 90) {
  console.log('优秀');
} else if (score >= 60) {
  console.log('及格');
} else {
  console.log('不及格');
}

// switch
switch (day) {
  case 1:
    console.log('周一');
    break;
  case 2:
    console.log('周二');
    break;
  default:
    console.log('其他');
}

// switch 穿透（fallthrough）
switch (n) {
  case 1:
  case 2:
    console.log('1 或 2');
    break;
}
```

### 5.2 循环语句

```js
// for 循环
for (let i = 0; i < 5; i++) {
  console.log(i);
}

// while
let i = 0;
while (i < 5) {
  console.log(i++);
}

// do...while（至少执行一次）
let j = 0;
do {
  console.log(j++);
} while (j < 5);

// for...in（枚举对象可枚举属性，含原型链）
const obj = { a: 1, b: 2 };
for (const key in obj) {
  if (obj.hasOwnProperty(key)) {
    console.log(key, obj[key]);
  }
}

// for...of（迭代可迭代对象）
const arr = [10, 20, 30];
for (const val of arr) {
  console.log(val);
}

// for...of 迭代 Map
const map = new Map([['a', 1], ['b', 2]]);
for (const [key, val] of map) {
  console.log(key, val);
}
```

### 5.3 跳转语句

```js
// break 跳出循环/switch
for (let i = 0; i < 10; i++) {
  if (i === 5) break;
}

// continue 跳过当前迭代
for (let i = 0; i < 10; i++) {
  if (i % 2 === 0) continue;
  console.log(i); // 1 3 5 7 9
}

// 带标签的 break/continue
outer: for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    if (j === 1) break outer; // 跳出外层循环
  }
}

// return（结束函数执行）
function fn() {
  return 42;
}

// throw（抛出异常）
throw new Error('出错了');
```

---

## 6. 函数

### 6.1 函数声明 vs 函数表达式

```js
// 函数声明（有提升）
function greet(name) {
  return `Hello, ${name}`;
}

// 函数表达式（无提升）
const greet = function(name) {
  return `Hello, ${name}`;
};

// 具名函数表达式（名称仅在内部可见）
const factorial = function fact(n) {
  return n <= 1 ? 1 : n * fact(n - 1);
};
```

### 6.2 箭头函数（ES6）

```js
// 基本语法
const add = (a, b) => a + b;

// 多行函数体
const greet = (name) => {
  const msg = `Hello, ${name}`;
  return msg;
};

// 单参数可省略括号
const double = n => n * 2;

// 无参数必须保留括号
const hello = () => 'Hello!';

// 返回对象字面量需加括号
const getUser = () => ({ name: 'Alice', age: 30 });

// 箭头函数没有自己的 this（继承外层 this）
// 箭头函数没有 arguments 对象
// 箭头函数不能用作构造函数（new）
// 箭头函数没有 prototype
```

### 6.3 参数

```js
// 默认参数（ES6）
function greet(name = 'World') {
  return `Hello, ${name}`;
}

// 剩余参数（ES6，必须在最后）
function sum(...nums) {
  return nums.reduce((a, b) => a + b, 0);
}
sum(1, 2, 3, 4); // 10

// arguments 对象（仅普通函数）
function fn() {
  console.log(arguments); // 类数组对象
  const args = Array.from(arguments);
}
```

### 6.4 函数特性

```js
// IIFE（立即执行函数）
(function() {
  console.log('立即执行');
})();

// 函数也是对象，可以有属性
function counter() {}
counter.count = 0;

// 函数的 call / apply / bind
function greet(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}
const user = { name: 'Alice' };

greet.call(user, 'Hello', '!');    // "Hello, Alice!"
greet.apply(user, ['Hi', '?']);    // "Hi, Alice?"
const boundGreet = greet.bind(user, 'Hey');
boundGreet('.');                   // "Hey, Alice."

// 纯函数（相同输入总返回相同输出，无副作用）
const pure = (x) => x * 2;

// 闭包
function makeCounter() {
  let count = 0;
  return {
    increment: () => ++count,
    get: () => count,
  };
}
const counter = makeCounter();
counter.increment(); // 1
counter.get();       // 1

// 高阶函数
const double = (fn) => (x) => fn(x) * 2;
const addOne = (x) => x + 1;
const addOneThenDouble = double(addOne);
addOneThenDouble(3); // 8

// 柯里化
const curry = (fn) => {
  return function curried(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
};
```

### 6.5 递归

```js
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// 尾递归优化（严格模式下部分引擎支持）
function factTail(n, acc = 1) {
  if (n <= 1) return acc;
  return factTail(n - 1, n * acc);
}
```

---

## 7. 对象

### 7.1 创建对象

```js
// 对象字面量
const user = {
  name: 'Alice',
  age: 30,
  greet() {        // 方法简写（ES6）
    return `Hi, I'm ${this.name}`;
  },
};

// 构造函数
function Person(name, age) {
  this.name = name;
  this.age = age;
}
const p = new Person('Bob', 25);

// Object.create（指定原型）
const proto = { greet() { return `Hi`; } };
const obj = Object.create(proto);
```

### 7.2 属性访问与操作

```js
const obj = { name: 'Alice', 'full name': 'Alice Smith' };

// 点操作符
obj.name;

// 方括号（动态属性名）
obj['full name'];
const key = 'name';
obj[key];

// 可选链
obj?.address?.city;

// 属性简写（ES6）
const name = 'Alice';
const user = { name }; // { name: 'Alice' }

// 计算属性名（ES6）
const prefix = 'get';
const methods = {
  [`${prefix}Name`]() { return this.name; }
};

// 属性检查
'name' in obj;            // true
obj.hasOwnProperty('name'); // true（不含原型链）

// 删除属性
delete obj.name;

// 枚举属性
Object.keys(obj)          // 自身可枚举属性名数组
Object.values(obj)        // 自身可枚举属性值数组
Object.entries(obj)       // 自身可枚举 [key, value] 数组
Object.getOwnPropertyNames(obj) // 含不可枚举属性（不含 Symbol）
```

### 7.3 属性描述符

```js
// 定义属性
Object.defineProperty(obj, 'id', {
  value: 1,
  writable: false,     // 不可写
  enumerable: false,   // 不可枚举
  configurable: false, // 不可配置/删除
});

// 获取描述符
Object.getOwnPropertyDescriptor(obj, 'id');

// getter / setter
const circle = {
  _radius: 5,
  get radius() { return this._radius; },
  set radius(r) {
    if (r < 0) throw new Error('半径不能为负');
    this._radius = r;
  },
  get area() { return Math.PI * this._radius ** 2; },
};
```

### 7.4 对象方法速查

```js
// 合并对象（浅拷贝）
Object.assign(target, source1, source2);

// 深拷贝（现代方法，ES2024）
const copy = structuredClone(obj);

// 展开浅拷贝（ES2018）
const clone = { ...obj };
const merged = { ...obj1, ...obj2 };

// 冻结对象（不可修改/添加/删除属性）
Object.freeze(obj);

// 密封对象（不可添加/删除属性，但可修改值）
Object.seal(obj);

// 原型操作
Object.getPrototypeOf(obj);
Object.setPrototypeOf(obj, newProto);

// 判断
Object.is(NaN, NaN) // true（不同于 ===）
Object.is(0, -0)    // false
```

### 7.5 原型链

```js
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function() {
  console.log(`${this.name} makes a noise.`);
};

function Dog(name) {
  Animal.call(this, name);
}
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;
Dog.prototype.bark = function() {
  console.log('Woof!');
};

const d = new Dog('Rex');
d.speak(); // "Rex makes a noise."
d.bark();  // "Woof!"
d instanceof Dog;    // true
d instanceof Animal; // true
```

---

## 8. 数组

### 8.1 创建数组

```js
const arr = [1, 2, 3];
const arr2 = new Array(3);          // [empty × 3]
const arr3 = Array.from({ length: 3 }, (_, i) => i); // [0, 1, 2]
const arr4 = Array.of(1, 2, 3);    // [1, 2, 3]
```

### 8.2 常用方法速查

#### 修改原数组

```js
arr.push(4)        // 末尾添加，返回新长度
arr.pop()          // 末尾删除，返回删除元素
arr.unshift(0)     // 开头添加，返回新长度
arr.shift()        // 开头删除，返回删除元素
arr.splice(1, 2)   // 从索引1删除2个元素，返回被删除元素
arr.splice(1, 0, 'a', 'b') // 在索引1插入元素
arr.reverse()      // 反转（原地）
arr.sort()         // 排序（原地，默认字符串排序）
arr.sort((a, b) => a - b)  // 数字升序
arr.fill(0, 2, 4)  // 用0填充索引2到4（不含）
arr.copyWithin(0, 3) // 将索引3以后的元素复制到索引0开始处
```

#### 不修改原数组

```js
arr.concat([4, 5])       // 合并数组，返回新数组
arr.slice(1, 3)          // 切片，返回新数组
arr.join(' - ')          // 连接为字符串
arr.indexOf(2)           // 首次出现的索引，-1表示不存在
arr.lastIndexOf(2)       // 最后一次出现的索引
arr.includes(2)          // 是否包含（ES2016）
arr.find(x => x > 2)    // 第一个满足条件的元素
arr.findIndex(x => x > 2) // 第一个满足条件的索引
arr.findLast(x => x > 2)  // 最后一个满足条件的元素（ES2023）
arr.findLastIndex(x => x > 2) // （ES2023）
arr.flat(2)              // 展平（参数为深度，Infinity全展平）
arr.flatMap(x => [x, x * 2]) // 先 map 后 flat(1)

// 迭代方法
arr.forEach((val, idx, arr) => {})      // 遍历（无返回值）
arr.map((val, idx) => val * 2)          // 映射，返回新数组
arr.filter((val) => val > 2)            // 过滤，返回新数组
arr.reduce((acc, val) => acc + val, 0)  // 左折叠
arr.reduceRight((acc, val) => acc + val, 0) // 右折叠
arr.every(x => x > 0)   // 是否全部满足
arr.some(x => x > 0)    // 是否至少一个满足

// 返回迭代器
arr.keys()    // 索引迭代器
arr.values()  // 值迭代器
arr.entries() // [索引, 值] 迭代器

// Array.from
Array.from('hello')           // ['h','e','l','l','o']
Array.from(new Set([1,2,3]))  // [1,2,3]
Array.from({length:3},(v,i)=>i) // [0,1,2]

// toSorted / toReversed / toSpliced / with（ES2023，不修改原数组）
arr.toSorted((a, b) => a - b)
arr.toReversed()
arr.toSpliced(1, 1, 'new')
arr.with(2, 99) // 替换索引2的元素，返回新数组
```

---

## 9. 解构赋值

### 9.1 数组解构

```js
const [a, b, c] = [1, 2, 3];

// 跳过元素
const [,, third] = [1, 2, 3]; // third = 3

// 默认值
const [x = 0, y = 0] = [1];   // x=1, y=0

// 剩余元素
const [first, ...rest] = [1, 2, 3, 4]; // first=1, rest=[2,3,4]

// 交换变量
let p = 1, q = 2;
[p, q] = [q, p]; // p=2, q=1

// 嵌套解构
const [[a1, a2], [b1, b2]] = [[1, 2], [3, 4]];

// 忽略返回值
const [, month, day] = '2024-01-15'.split('-');
```

### 9.2 对象解构

```js
const { name, age } = { name: 'Alice', age: 30 };

// 别名
const { name: userName, age: userAge } = user;

// 默认值
const { name = 'Unknown', role = 'user' } = {};

// 默认值 + 别名
const { name: n = 'Unknown' } = {};

// 剩余属性（ES2018）
const { a, ...others } = { a: 1, b: 2, c: 3 };
// others = { b: 2, c: 3 }

// 嵌套解构
const { address: { city, zip } } = user;

// 函数参数解构
function greet({ name = 'World', greeting = 'Hello' } = {}) {
  return `${greeting}, ${name}!`;
}
```

---

## 10. 展开与剩余运算符

```js
// 展开数组
const arr = [1, 2, 3];
const arr2 = [...arr, 4, 5];         // [1,2,3,4,5]
Math.max(...arr);                    // 3

// 展开对象（ES2018）
const obj = { a: 1 };
const obj2 = { ...obj, b: 2 };      // { a: 1, b: 2 }

// 后面的属性会覆盖前面的
const merged = { ...defaults, ...overrides };

// 复制数组/对象（浅拷贝）
const arrCopy = [...arr];
const objCopy = { ...obj };

// 剩余参数
function fn(first, ...rest) {
  console.log(first, rest);
}
fn(1, 2, 3); // 1, [2, 3]

// 将字符串/Set/Map 转为数组
[...'hello']                 // ['h','e','l','l','o']
[...new Set([1,2,2,3])]     // [1,2,3]
[...new Map([['a',1]])]     // [['a',1]]
```

---

## 11. 类（Class）

### 11.1 基本语法

```js
class Animal {
  // 公有字段（ES2022）
  species = 'Unknown';

  // 私有字段（ES2022，# 前缀）
  #name;
  #sound;

  // 静态属性
  static count = 0;

  constructor(name, sound) {
    this.#name = name;
    this.#sound = sound;
    Animal.count++;
  }

  // 实例方法
  speak() {
    return `${this.#name} says ${this.#sound}`;
  }

  // getter / setter
  get name() { return this.#name; }
  set name(val) { this.#name = val; }

  // 静态方法
  static create(name, sound) {
    return new Animal(name, sound);
  }

  // 私有方法（ES2022）
  #validate() { return true; }
}

const dog = new Animal('Rex', 'Woof');
dog.speak();           // "Rex says Woof"
Animal.count;          // 1
Animal.create('Cat', 'Meow');
```

### 11.2 继承

```js
class Dog extends Animal {
  #tricks = [];

  constructor(name) {
    super(name, 'Woof'); // 必须先调用 super()
  }

  learn(trick) {
    this.#tricks.push(trick);
  }

  perform() {
    return this.#tricks.join(', ');
  }

  // 重写父类方法
  speak() {
    return `${super.speak()}! (wags tail)`;
  }
}

const rex = new Dog('Rex');
rex.speak();
rex instanceof Dog;    // true
rex instanceof Animal; // true
```

### 11.3 Mixin 模式

```js
const Serializable = (Base) => class extends Base {
  serialize() {
    return JSON.stringify(this);
  }
  static deserialize(json) {
    return Object.assign(new this(), JSON.parse(json));
  }
};

const Validatable = (Base) => class extends Base {
  validate() { return true; }
};

class User extends Serializable(Validatable(Animal)) {}
```

---

## 12. 模块（Module）

### 12.1 ES Modules（ESM）

```js
// 命名导出（math.js）
export const PI = 3.14159;
export function add(a, b) { return a + b; }
export class Calculator { /* ... */ }

// 默认导出（每个模块只能有一个）
export default class App { /* ... */ }

// 聚合导出
export { PI, add };
export { add as sum }; // 重命名

// 重导出（re-export）
export { add } from './math.js';
export * from './math.js';
export * as MathUtils from './math.js';
```

```js
// 命名导入（main.js）
import { PI, add } from './math.js';
import { add as sum } from './math.js'; // 重命名

// 默认导入
import App from './app.js';

// 命名空间导入
import * as Math from './math.js';
Math.add(1, 2);

// 混合导入
import App, { PI, add } from './module.js';

// 动态导入（返回 Promise）
const module = await import('./math.js');
module.add(1, 2);

// 顶层 await（ES2022，仅 ESM 中）
const data = await fetch('/api/data').then(r => r.json());
```

### 12.2 CommonJS（Node.js）

```js
// 导出
module.exports = { add, PI };
module.exports.add = add;
exports.add = add; // 不推荐

// 导入
const { add } = require('./math');
const math = require('./math');
```

---

## 13. Promise 与异步

### 13.1 Promise 基础

```js
// 创建 Promise
const promise = new Promise((resolve, reject) => {
  setTimeout(() => {
    const success = true;
    if (success) resolve('成功结果');
    else reject(new Error('失败原因'));
  }, 1000);
});

// 消费 Promise
promise
  .then(result => console.log(result))      // 成功回调
  .catch(err => console.error(err))         // 失败回调
  .finally(() => console.log('总是执行')); // 无论成功失败都执行

// 链式调用
fetch('/api/user')
  .then(res => res.json())
  .then(user => user.name)
  .then(name => console.log(name))
  .catch(console.error);
```

### 13.2 Promise 静态方法

```js
// 全部成功才 resolve，任一失败则 reject
Promise.all([p1, p2, p3]).then(([r1, r2, r3]) => {});

// 全部完成（无论成功失败）
Promise.allSettled([p1, p2]).then(results => {
  results.forEach(({ status, value, reason }) => {});
});

// 任意一个完成则 resolve/reject
Promise.race([p1, p2]).then(first => {});

// 任意一个成功则 resolve，全部失败才 reject
Promise.any([p1, p2]).then(first => {});

// 创建已解决/已拒绝的 Promise
Promise.resolve(42);
Promise.reject(new Error('err'));
```

### 13.3 async / await（ES2017）

```js
async function fetchUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const user = await response.json();
    return user;
  } catch (err) {
    console.error('获取用户失败:', err);
    throw err; // 重新抛出
  }
}

// 并行执行（不要 await 后面紧跟 await，那是串行）
async function parallel() {
  const [user, posts] = await Promise.all([
    fetchUser(1),
    fetchPosts(),
  ]);
  return { user, posts };
}

// 顶层 await（ESM 模块中）
const config = await loadConfig();

// async 函数总是返回 Promise
const result = await fetchUser(1);
```

### 13.4 回调 → Promise 转换

```js
// 手动 promisify
function readFileAsync(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

// Node.js util.promisify
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
```

---

## 14. 迭代器与生成器

### 14.1 迭代器协议

```js
// 自定义迭代器
const range = {
  from: 1,
  to: 5,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        if (current <= last) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
};

for (const n of range) {
  console.log(n); // 1 2 3 4 5
}
[...range]; // [1, 2, 3, 4, 5]
```

### 14.2 生成器（Generator）

```js
// 生成器函数
function* count(start = 0, step = 1) {
  while (true) {
    yield start;
    start += step;
  }
}

const counter = count(1, 2);
counter.next(); // { value: 1, done: false }
counter.next(); // { value: 3, done: false }

// 有限生成器
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// 委托生成器
function* gen1() { yield 1; yield 2; }
function* gen2() {
  yield* gen1(); // 委托给 gen1
  yield 3;
}
[...gen2()]; // [1, 2, 3]

// 双向通信
function* adder() {
  let sum = 0;
  while (true) {
    const val = yield sum;
    if (val === null) break;
    sum += val;
  }
  return sum;
}
const g = adder();
g.next();     // { value: 0, done: false }（启动）
g.next(10);   // { value: 10, done: false }
g.next(5);    // { value: 15, done: false }
g.next(null); // { value: 15, done: true }

// 异步生成器（ES2018）
async function* asyncRange(start, end) {
  for (let i = start; i <= end; i++) {
    await new Promise(r => setTimeout(r, 100));
    yield i;
  }
}

for await (const n of asyncRange(1, 5)) {
  console.log(n);
}
```

---

## 15. Symbol

```js
// 创建唯一 Symbol
const id = Symbol('id');
const id2 = Symbol('id');
id === id2; // false（每次都不同）

// 全局 Symbol 注册表
const s = Symbol.for('shared');
Symbol.for('shared') === s; // true
Symbol.keyFor(s); // 'shared'

// 作为对象属性键（不会出现在 for...in 和 Object.keys 中）
const obj = {
  [id]: 123,
  name: 'Alice',
};
obj[id];                              // 123
Object.getOwnPropertySymbols(obj);    // [Symbol(id)]

// 内置 Well-Known Symbols
class MyArray {
  // 自定义 instanceof 行为
  static [Symbol.hasInstance](instance) {
    return Array.isArray(instance);
  }
  // 自定义 for...of 行为
  [Symbol.iterator]() { /* ... */ }
  // 自定义 toString
  get [Symbol.toStringTag]() { return 'MyArray'; }
  // 自定义展开行为
  get [Symbol.isConcatSpreadable]() { return true; }
}

// 其他常见 Well-Known Symbols
Symbol.toPrimitive      // 自定义类型转换
Symbol.species          // 自定义派生类
Symbol.asyncIterator    // 异步迭代器
```

---

## 16. Map / Set / WeakMap / WeakSet

### 16.1 Map

```js
const map = new Map();

// 设置/获取/检查
map.set('key', 'value');
map.set(obj, 'objectKey');  // 任何值都可以作键
map.get('key');             // 'value'
map.has('key');             // true
map.delete('key');
map.size;                   // 键值对数量
map.clear();

// 初始化
const map2 = new Map([['a', 1], ['b', 2], ['c', 3]]);

// 迭代
for (const [key, val] of map2) { }
map2.forEach((val, key) => { });
[...map2.keys()]
[...map2.values()]
[...map2.entries()]

// Map vs Object
// Map 的键可以是任意类型
// Map 保持插入顺序
// Map 有 size 属性
// Map 性能更好（频繁增删时）
```

### 16.2 Set

```js
const set = new Set([1, 2, 3, 2, 1]); // Set {1, 2, 3}（自动去重）

set.add(4);
set.has(3);    // true
set.delete(1);
set.size;      // 3
set.clear();

// 迭代
for (const val of set) { }
set.forEach(val => { });
[...set]               // 转为数组
Array.from(set)        // 转为数组

// 数组去重
const unique = [...new Set(arr)];

// 集合运算
const union = new Set([...setA, ...setB]);
const intersection = new Set([...setA].filter(x => setB.has(x)));
const difference = new Set([...setA].filter(x => !setB.has(x)));
```

### 16.3 WeakMap / WeakSet

```js
// WeakMap：键必须是对象，弱引用（不阻止 GC）
const wm = new WeakMap();
let dom = document.querySelector('#app');
wm.set(dom, { clicks: 0 });
wm.get(dom);     // { clicks: 0 }
wm.has(dom);
wm.delete(dom);
// 无 size，无迭代（键随时可能被 GC）

// WeakSet：值必须是对象，弱引用
const ws = new WeakSet();
ws.add(dom);
ws.has(dom);     // true
ws.delete(dom);

// 典型用途：私有数据、对象元数据，防止内存泄漏
```

---

## 17. Proxy 与 Reflect

### 17.1 Proxy

```js
const handler = {
  // 拦截属性读取
  get(target, prop, receiver) {
    console.log(`读取 ${prop}`);
    return Reflect.get(target, prop, receiver);
  },
  // 拦截属性设置
  set(target, prop, value, receiver) {
    if (typeof value !== 'number') throw new TypeError('必须是数字');
    return Reflect.set(target, prop, value, receiver);
  },
  // 拦截属性删除
  deleteProperty(target, prop) {
    console.log(`删除 ${prop}`);
    return Reflect.deleteProperty(target, prop);
  },
  // 拦截 in 运算符
  has(target, prop) {
    return prop in target;
  },
  // 拦截函数调用
  apply(target, thisArg, args) {
    return Reflect.apply(target, thisArg, args);
  },
  // 拦截 new 运算符
  construct(target, args) {
    return Reflect.construct(target, args);
  },
  // 拦截 Object.keys 等
  ownKeys(target) {
    return Reflect.ownKeys(target);
  },
};

const proxy = new Proxy({}, handler);
proxy.age = 25;    // 触发 set
proxy.age;         // 触发 get → 25
```

### 17.2 Reflect

```js
// Reflect 方法与 Proxy handler 一一对应
Reflect.get(target, prop)
Reflect.set(target, prop, value)
Reflect.has(target, prop)           // 等同于 prop in target
Reflect.deleteProperty(target, prop) // 等同于 delete target.prop
Reflect.apply(fn, thisArg, args)    // 等同于 fn.apply(thisArg, args)
Reflect.construct(Class, args)       // 等同于 new Class(...args)
Reflect.defineProperty(target, prop, descriptor)
Reflect.getOwnPropertyDescriptor(target, prop)
Reflect.getPrototypeOf(target)
Reflect.setPrototypeOf(target, proto)
Reflect.ownKeys(target)             // 所有自身键（含 Symbol）
Reflect.isExtensible(target)
Reflect.preventExtensions(target)
```

---

## 18. 错误处理

### 18.1 try / catch / finally

```js
try {
  const data = JSON.parse(invalidJson);
  riskyOperation();
} catch (error) {
  // error 是捕获的异常
  console.error(error.message);
  console.error(error.stack);
} finally {
  // 无论是否出错都执行（如资源清理）
  cleanup();
}

// 可选 catch 绑定（ES2019）
try {
  JSON.parse('invalid');
} catch {
  console.log('解析失败');
}
```

### 18.2 错误类型

```js
new Error('通用错误')
new TypeError('类型错误')
new RangeError('范围错误')
new ReferenceError('引用错误')
new SyntaxError('语法错误')
new URIError('URI 错误')
new EvalError('eval 错误')

// 自定义错误
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    // 修复原型链（TypeScript 中需要）
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

try {
  throw new ValidationError('邮箱格式错误', 'email');
} catch (e) {
  if (e instanceof ValidationError) {
    console.log(e.field); // 'email'
  } else {
    throw e; // 重新抛出未处理的错误
  }
}
```

### 18.3 全局错误捕获

```js
// 浏览器
window.onerror = (msg, url, line, col, error) => {
  console.error(msg, error);
  return true; // 阻止默认行为
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason);
  event.preventDefault();
});

// Node.js
process.on('uncaughtException', (err) => {
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(reason);
});
```

---

## 19. 正则表达式

### 19.1 创建正则

```js
// 字面量（推荐）
const re = /pattern/flags;

// 构造函数（动态模式时使用）
const re2 = new RegExp('pattern', 'flags');
const re3 = new RegExp(variable, 'gi');
```

### 19.2 标志（Flags）

| 标志 | 说明 |
|------|------|
| `g` | 全局匹配（不止匹配第一个） |
| `i` | 忽略大小写 |
| `m` | 多行模式（^ $ 匹配每行的开始/结束） |
| `s` | dotAll 模式（. 匹配换行符）（ES2018） |
| `u` | Unicode 模式 |
| `y` | 粘性匹配（从 lastIndex 开始） |
| `d` | 返回子匹配的下标（ES2022） |
| `v` | Unicode Sets（ES2024） |

### 19.3 元字符速查

```
.       任意字符（除换行）
^       行首
$       行尾
\d      数字 [0-9]
\D      非数字 [^0-9]
\w      单词字符 [A-Za-z0-9_]
\W      非单词字符
\s      空白字符（空格/制表符/换行等）
\S      非空白字符
\b      单词边界
\B      非单词边界
\n      换行
\t      制表符
\0      null 字符
\uXXXX  Unicode 字符

[abc]   字符类（a 或 b 或 c）
[^abc]  否定字符类
[a-z]   范围
[a-zA-Z0-9]

(abc)   捕获组
(?:abc) 非捕获组
(?<name>abc) 命名捕获组（ES2018）
(?=abc) 正向先行断言
(?!abc) 负向先行断言
(?<=abc) 正向后行断言（ES2018）
(?<!abc) 负向后行断言（ES2018）

a|b     交替（a 或 b）
```

### 19.4 量词

```
*       0 次或多次（贪婪）
+       1 次或多次（贪婪）
?       0 次或 1 次
{n}     恰好 n 次
{n,}    至少 n 次
{n,m}   n 到 m 次
*?      0 次或多次（非贪婪/懒惰）
+?      1 次或多次（非贪婪）
??      0 次或 1 次（非贪婪）
```

### 19.5 正则方法

```js
const re = /(\d{4})-(\d{2})-(\d{2})/;
const str = '日期: 2024-01-15';

// test：测试是否匹配
re.test(str);              // true

// exec：返回匹配详情
const match = re.exec(str);
// match[0] = '2024-01-15'（完整匹配）
// match[1] = '2024'（第一组）
// match.index = 4（匹配位置）

// String 方法
str.match(re);             // 同 exec（无 g 标志时）
str.match(/\d+/g);         // ['2024', '01', '15']（g 标志返回所有匹配）
str.matchAll(/\d+/g);      // 返回迭代器（ES2020）
str.search(re);            // 4（匹配位置）
str.replace(re, 'DATE');   // '日期: DATE'
str.replace(/(\d+)/g, '[$1]'); // 用捕获组替换
str.replace(re, (match, y, m, d) => `${d}/${m}/${y}`);
str.replaceAll('a', 'b');  // 替换所有（ES2021）
str.split(/\s+/);          // 以空白分割

// 命名捕获组（ES2018）
const dateRe = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const { groups: { year, month, day } } = str.match(dateRe);
```

---

## 20. 内置对象速查

### 20.1 Math

```js
Math.abs(-5)         // 5
Math.ceil(4.1)       // 5
Math.floor(4.9)      // 4
Math.round(4.5)      // 5
Math.trunc(4.9)      // 4（截断小数）
Math.sign(-3)        // -1
Math.max(1, 2, 3)    // 3
Math.min(1, 2, 3)    // 1
Math.pow(2, 10)      // 1024
Math.sqrt(16)        // 4
Math.cbrt(27)        // 3
Math.log(Math.E)     // 1
Math.log2(8)         // 3
Math.log10(100)      // 2
Math.random()        // 0-1 之间的随机数
Math.PI              // 3.14159...
Math.E               // 2.71828...
Math.hypot(3, 4)     // 5（勾股定理）
Math.clz32(1)        // 31（前导零数量）
```

### 20.2 Number

```js
Number.isInteger(42)      // true
Number.isFinite(Infinity) // false
Number.isNaN(NaN)         // true（比全局 isNaN 更准确）
Number.isSafeInteger(42)  // true（在安全整数范围内）

Number.parseInt    === parseInt    // true
Number.parseFloat  === parseFloat  // true

Number.MAX_SAFE_INTEGER  // 9007199254740991
Number.MIN_SAFE_INTEGER  // -9007199254740991
Number.MAX_VALUE         // 最大正浮点数
Number.EPSILON           // 最小精度差

(3.14159).toFixed(2)     // "3.14"
(1234).toString(16)      // "4d2"（16进制）
(1234).toString(2)       // "10011010010"（二进制）
(0.0000123).toExponential(2) // "1.23e-5"
```

### 20.3 String

```js
const s = 'Hello, World!';

s.length             // 13
s.charAt(0)          // 'H'
s.charCodeAt(0)      // 72
s[0]                 // 'H'（ES5，可能对 Unicode 不准确）

s.toUpperCase()      // 'HELLO, WORLD!'
s.toLowerCase()      // 'hello, world!'
s.trim()             // 去除首尾空白
s.trimStart()        // 去除开头空白（ES2019）
s.trimEnd()          // 去除结尾空白（ES2019）

s.startsWith('Hello')   // true
s.endsWith('!')         // true
s.includes('World')     // true

s.indexOf('o')       // 4
s.lastIndexOf('o')   // 8

s.slice(7, 12)       // 'World'（支持负索引）
s.substring(7, 12)   // 'World'（不支持负索引）

s.split(', ')        // ['Hello', 'World!']
s.replace('World', 'JS') // 'Hello, JS!'
s.replaceAll('l', 'L')   // 'HeLLo, WorLd!'（ES2021）

'ab'.repeat(3)       // 'ababab'
'5'.padStart(3, '0') // '005'（ES2017）
'5'.padEnd(3, '0')   // '500'（ES2017）

// at（ES2022，支持负索引）
s.at(-1)             // '!'

// 原始字符串标签
String.raw`\n\t`     // '\\n\\t'（不转义）

// Unicode 方法
String.fromCharCode(65)          // 'A'
String.fromCodePoint(128512)     // '😀'
'😀'.codePointAt(0)              // 128512
'Hello'.normalize('NFC')         // Unicode 标准化
```

### 20.4 Date

```js
const now = new Date();
const d = new Date('2024-01-15T10:30:00');
const d2 = new Date(2024, 0, 15, 10, 30, 0); // 月份从 0 开始

// 获取
d.getFullYear()    // 2024
d.getMonth()       // 0 (0-11)
d.getDate()        // 15
d.getDay()         // 1 (0=周日)
d.getHours()       // 10
d.getMinutes()     // 30
d.getSeconds()     // 0
d.getTime()        // 时间戳（毫秒）

// 设置
d.setFullYear(2025);

// 格式化
d.toISOString()    // "2024-01-15T02:30:00.000Z"
d.toLocaleDateString('zh-CN')  // "2024/1/15"
d.toLocaleTimeString('zh-CN')  // "上午10:30:00"
d.toLocaleString('zh-CN')

// 时间戳
Date.now()         // 当前时间戳（毫秒）
+new Date()        // 同上
```

### 20.5 JSON

```js
// 序列化
JSON.stringify({ name: 'Alice', age: 30 });
// '{"name":"Alice","age":30}'

JSON.stringify(obj, null, 2);       // 美化（2 空格缩进）
JSON.stringify(obj, ['name', 'age']); // 只序列化指定字段
JSON.stringify(obj, (key, val) => {  // 自定义序列化
  if (typeof val === 'function') return undefined;
  return val;
});

// 反序列化
JSON.parse('{"name":"Alice"}');
JSON.parse(json, (key, val) => {  // 自定义反序列化
  if (key === 'date') return new Date(val);
  return val;
});

// toJSON 方法（自定义序列化行为）
class User {
  toJSON() {
    return { name: this.name };
  }
}
```

---

## 21. ES2020–2024 新特性

### ES2020

```js
// 可选链 ?.
obj?.prop?.method?.()

// 空值合并 ??
const val = data ?? '默认值';

// BigInt
const big = 9007199254740991n;

// Promise.allSettled
await Promise.allSettled([p1, p2]);

// globalThis（跨环境全局对象）
globalThis.setTimeout;

// String.matchAll
for (const match of str.matchAll(/\d+/g)) { }

// 动态导入
const mod = await import('./module.js');
```

### ES2021

```js
// String.replaceAll
'aabbcc'.replaceAll('b', 'x'); // 'aaxxcc'

// Promise.any
await Promise.any([p1, p2, p3]);

// 逻辑赋值运算符
x &&= 5;  x ||= 5;  x ??= 5;

// 数字分隔符（提高可读性）
const million = 1_000_000;
const bytes = 0xFF_EC_D1;

// WeakRef（弱引用）
const ref = new WeakRef(target);
ref.deref(); // 可能返回 undefined（已被 GC）

// FinalizationRegistry（GC 回调）
const registry = new FinalizationRegistry((value) => {
  console.log('对象已被回收:', value);
});
registry.register(obj, 'some value');
```

### ES2022

```js
// 类字段（公有/私有/静态）
class Foo {
  publicField = 1;
  #privateField = 2;
  static staticField = 3;
  static #privateStatic = 4;
  
  #privateMethod() {}
  static #privateStaticMethod() {}
  
  // 静态块（类初始化）
  static {
    Foo.staticField = complexInit();
  }
}

// Array/String/TypedArray.at（负索引）
[1,2,3].at(-1);    // 3
'hello'.at(-1);    // 'o'

// Object.hasOwn（替代 hasOwnProperty）
Object.hasOwn(obj, 'key'); // true/false

// 顶层 await（ESM）
const data = await fetchData();

// Error.cause（错误链）
throw new Error('上层错误', { cause: originalError });

// 正则 /d 标志（返回子匹配下标）
const match = /(\d+)/d.exec('hello 123');
match.indices[1]; // [6, 9]
```

### ES2023

```js
// Array.findLast / findLastIndex
[1,2,3,4].findLast(x => x % 2 === 0);      // 4
[1,2,3,4].findLastIndex(x => x % 2 === 0); // 3

// 不修改原数组的新方法
arr.toSorted()          // 返回排序后的新数组
arr.toReversed()        // 返回翻转后的新数组
arr.toSpliced(1, 1, 'x') // 返回 splice 后的新数组
arr.with(2, 99)         // 返回替换索引2元素后的新数组

// Hashbang 注释（#!/usr/bin/env node）
#!/usr/bin/env node
console.log('Hello');

// Symbol 作为 WeakMap 键（ES2023）
const key = Symbol('key');
const wm = new WeakMap();
wm.set(key, 'value');
```

### ES2024

```js
// Promise.withResolvers（返回 {promise, resolve, reject}）
const { promise, resolve, reject } = Promise.withResolvers();
setTimeout(() => resolve('done'), 1000);
await promise;

// Object.groupBy / Map.groupBy
const items = [
  { name: 'apple', type: 'fruit' },
  { name: 'banana', type: 'fruit' },
  { name: 'carrot', type: 'vegetable' },
];
const grouped = Object.groupBy(items, item => item.type);
// { fruit: [...], vegetable: [...] }

// 正则 /v 标志（Unicode Sets）
/[\p{Letter}--[A-Z]]/v // 字母中减去大写字母（差集）
/[\p{Letter}&&\p{ASCII}]/v // 交集

// ArrayBuffer.transfer（转移缓冲区所有权）
const newBuffer = buffer.transfer(newByteLength);

// Atomics.waitAsync（非阻塞等待）
await Atomics.waitAsync(sharedArray, index, expectedValue).value;
```

---

## 附录：常见设计模式

```js
// 单例模式
class Singleton {
  static #instance = null;
  static getInstance() {
    if (!Singleton.#instance) {
      Singleton.#instance = new Singleton();
    }
    return Singleton.#instance;
  }
}

// 观察者模式
class EventEmitter {
  #listeners = new Map();
  on(event, fn) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push(fn);
    return () => this.off(event, fn); // 返回取消订阅函数
  }
  off(event, fn) {
    this.#listeners.set(event, this.#listeners.get(event)?.filter(l => l !== fn));
  }
  emit(event, ...args) {
    this.#listeners.get(event)?.forEach(fn => fn(...args));
  }
}

// 工厂模式
function createAnimal(type, name) {
  const animals = { dog: Dog, cat: Cat };
  const AnimalClass = animals[type];
  if (!AnimalClass) throw new Error(`未知类型: ${type}`);
  return new AnimalClass(name);
}

// 装饰器模式
function readonly(target, name, descriptor) {
  descriptor.writable = false;
  return descriptor;
}

// 防抖
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流
function throttle(fn, interval) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      return fn.apply(this, args);
    }
  };
}

// 记忆化（memoize）
function memoize(fn) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}
```

---

> 📌 **参考资源**
> - [MDN Web Docs](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)
> - [ECMAScript 规范](https://tc39.es/ecma262/)
> - [TC39 提案追踪](https://github.com/tc39/proposals)
> - [JavaScript.info](https://zh.javascript.info/)
