---
title: 手撕一个 new 方法
date: 2025-12-30 22:00:00 +0800
tags: 前端
subtitle: 'new的四种返回情况'
remark: 'new的四种返回情况，以及如何构造一个 new 方法，模拟实现 new 方法，模拟实现 new 方法的四种返回情况。'
---

# 手撕一个 new 方法

先了解一下 new 的四种返回情况：

1. 如果构造函数返回一个基本类型，则依旧会返回新创建的对象

   ```javascript
   function Person(name) {
     this.name = name;
     return 'Pika';
   }
   const person = new Person('John');
   console.log(person); // { name: 'John' }
   ```

2. 如果构造函数返回一个对象，则会返回这个对象并替换新创建的对象

   ```javascript
   function Person(name) {
     this.name = name;
     return {
       name: 'Pika',
     };
   }
   const person = new Person('John');
   console.log(person); // { name: 'Pika' }
   ```

3. 如果构造函数返回一个函数，则会返回该函数并替换新创建的对象

   ```javascript
   function Person(name) {
     this.name = name;
     return function () {
       return 'Pika';
     };
   }
   const person = new Person('John');
   console.log(person); // function() { return 'Pika'; }
   ```

4. 如果构造函数返回一个 null 或 undefined，则视为基本类型返回

   ```javascript
   function Person(name) {
     this.name = name;
     return null;
   }
   const person = new Person('John');
   console.log(person); // { name: 'John' }
   ```

## 构造一个 new 方法

基于上述四种返回情况，我们可以构造一个 new 方法：

```javascript
function new(func, ...args) {
  // 如果构造函数不是函数，则抛出错误
  if (typeof func !== 'function') {
    throw new TypeError('func is not a function');
  }

  // 创建一个新对象，继承构造函数的原型
  const obj = Object.create(func.prototype);
  // 执行构造函数，将新对象绑定到构造函数上
  const result = func.apply(obj, args);

  // 如果构造函数返回一个对象，则返回该对象
  // 如果构造函数返回一个函数，则返回该函数
  // 如果构造函数返回一个 null 或 undefined，则返回新创建的对象
  const isObject = typeof result === 'object' && result !== null;
  const isFunction = typeof result === 'function';
  return isObject || isFunction ? result : obj;
}
```
