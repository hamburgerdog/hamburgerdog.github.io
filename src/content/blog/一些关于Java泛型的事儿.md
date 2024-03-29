---
title: 'Java泛型通配符的事儿'
date: 2021-03-20 20:00:00 +0800
tags: 后端
subtitle: 'Java泛型参数类型|边界符'
---

# 一些关于 Java 泛型通配符的事儿

常见的 Java 泛型通配符有：

- ? 表示未知类型（最特殊的一个通配符）
- T (Type) 表示某一个具体的 Java 类型
- K , V (Key , Value) 表示键和值两种类型
- E (Element) 常用于表示容器中存放的数据的类型

除？外，其他的通配符只是一种在平时书写代码时遵守的习惯而已，不具有强制性，你也可以使用其他的字母。

泛型是用来帮助我们进行类型安全检查的，使用泛型还可以提高数据转换的快捷（为我们提供了自动的隐式的类型转换），但注意 java 在编译时是会执行泛型擦除的，具体操作其实很简单，就是去掉<>把泛型换成具体的类型而已。

## 特殊的 ？之边界通配符

如前文所说 ? 表示一个未知类型，其实它本身表示一个无界通配符，经常会和上下边界符搭配使用如: 上边界`<? extends A>`表示任何继承于 A 或者 A 类本身，下边界`<? super B>` 表示 B 类本身或者 B 的父类。

1. 由于 <?>表示一个未知类型，如`List<?> list`表示一个存放未知类型数据的list，因为类型未知，所以我们是不能向其中添加数据，而`List list`表示一个存放`Object`类型数据的 list，所以我们可以往其中添加任意类型的对象。
2. `List<? extends A>` 满足 get 原则，我们只可以从中读取数据，因为里面存放的数据都是 A 类本身或者 A 的子类，所以我们可以把读取的数据全部强制转换成 A 类因此可以读取，不能存放是因为编译时要进行类型擦除，无法满足类型安全。
3. `List<? super A>` 满足 put 原则，我们只可以向其存放数据，因为里面存放的数据都是 A 类本身或者 A 的父类，所以我们可以在存放数据时只能添加 A 的子类，而读取时因为类型众多而无法转换。

> 这里有一个我见过解释最清晰的例子：
> [Java 泛型 <? super T> 中 super 怎么 理解？与 extends 有何不同？ - 胖君的回答 - 知乎](https://www.zhihu.com/question/20400700/answer/117464182)

## ? 与 T 通配符的差别

T 表示的一定是一个具体的类，`<T extends E>`表示是 E 的某一个具体的子类，在类型擦除的时候会变成 T 表示的类型，因此是可以操作数据的，? 表示的是不在乎具体子类的只需要满足某一关系（范围）即可。

T 还可以多重参数限定`<T extends InterfaceA & InterfaceB>`而 ？不行。

？经常被用于类内 Class 字段的声明（常见于反射中）

```java
public A{
  class<T> clazzT;	//	报错，因为类型擦除需要具体的类型
  class<?> clazz;		//	不报错
}

public B<T>{
  class<T> clazzT;	//	不报错
  class<?> clazz;		//	不报错
}
```

> 参考阅读文章：[聊一聊-JAVA 泛型中的通配符 T，E，K，V，？](https://juejin.cn/post/6844903917835419661)
