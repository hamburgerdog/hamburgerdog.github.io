---
title:  "What happens after Array<T> calls sorted()？"
date:   2021-11-29 20:40:00 +0800
tags: 随记 前端
color: rgb(154,133,255)
cover: '../assets/arraysort.png'
---

# 🤔 What happens after Array\<T\> calls sorted()？

我们先看这个例子，猜一下控制台会输出什么？这两个输出有什么样的分别？

```typescript
//	1 ?
console.log([-1,0,1,2,-1,-4,-2,-3,3,0,4].sort());
//	2 ?
console.log([-1,0,1,2,-1,-4,-2,-3,3,0,4].sort((a, b) => a - b; ));
```

没错，这里的 **步骤1** 并没有最直观地返回一个按数值大小排序的数组，而是返回了`[-1, -1, -2, -3, -4, 0, 0, 1, 2, 3, 4]`，你知道为什么会这样输出吗？这是方法默认是按照什么顺序来排序的？

## WHY

我们都知道Javascript这门语言中存在着繁杂的类型转换，如执行` == ,  + `等操作的时候，Js会根据数据转换的倾向来选择是使用`ToString / ToNumber`，那么这里和类型转换有关系吗？是否存在着某种类型转换的倾向性(`ToPrimitive`)？（类型转换相关的知识可以看这篇文章[JavaScript 深入之头疼的类型转换(上)](https://github.com/mqyqingfeng/Blog/issues/159)）

我们先尝试着从`[true, false].sort()`这里入手，这里的排序输出是`[false, true]`，有可能存在以下两种情况

* 倾向于ToNumber，即将boolean转换成了number，再按数值大小比较
* 倾向于ToString，首字母‘f’的顺序比‘t’靠前

结合 **步骤1** 我们可以猜测ToNumber的倾向是相对低的，这里看来ToString的嫌疑还是大一点。(当然也不排除`Array.prototype.sorted()`内部有一套类型转换的规则，将Boolean和Number的转换区分开了，如果Javascript愿意对非泛型数组进行这样的操作的话。逃 :D)

根据上面的猜测，我们考虑一下`[true, false, 0, 1].sort()`的输出会是什么样子的呢？答案是`[0, 1, false, true]`，很明显这里是用的字符来进行比较，根据[「mdn」-Array.prototype.sort()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)上更精确的说法是**默认使用了原地算法依据Unicode位点的顺序来排序**的。举例有`[80,9,100,10,35,].sort()`输出了`[10, 100, 35, 80, 9]`，因为`'100'`比`'10'`多了一位，而`'80'`中的字符8要比字符9的顺序靠前， **步骤1** 的输出结果也就不难解释。

## ANSWER

总结一下，**`Array.prototype.sorted()`这个方法是采取字符位点来排序的**，和`ToPrimitive`类型转换并没有关系，而且代码标准的字符集是UTF-16。这种排序可能最开始会违背我们的直觉，但要知道Javascript是一门弱类型的语言，没有Typescript加持的情况下是不存在泛型数组/集合的，一个Array里面可能塞进去了多个类型的值，如果的话按照原始值/数值来比较的话会产生很多无法比较的问题。

> 注意在ES6中，字符的编码方式也迎来了新的改动，添加了符合Unicode的`u`修饰符和`String.codePointAt()`等API，修改了长字符length长度问题和实现迭代器接口等等。

在日常使用的时候，最好不用使用默认的排序方式！最好像在 **步骤2** 使用`sort()`一样，我们需要传入了一个自定义的排序函数，这样就不会受到上述默认行为的影响。