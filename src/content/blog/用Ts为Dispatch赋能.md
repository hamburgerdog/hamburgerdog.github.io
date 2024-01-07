---
title: '用Ts为Dispatch赋能'
date: 2021-09-14 23:59:00 +0800
tags: 前端
---

# 用 TS 为 Dispatch 赋能

最近的项目中的状态管理是通过`dva`这个库实现的，其用法和`redux`别无二致，具体的可以去查看相关文档或者 git 仓库，这里就不展开叙述了。这里我们在开发时会经常使用到`dispatch()`来更新状态，这个方法由于种种限制，代码提示是不完全的经常需要手动的去填入一些*“硬编码”*，使用的体验是很差的，填写`namescpace/actionType`的时候还容易出错，因此这篇文章就简单介绍了我是如何通过 TS 的帮助来为`dispatch()`编写对应的代码提示功能以提升编程体验的

## 提前准备

要体验到 Ts 魔法的魅力，我们需要在项目中先做好各种保障工作，搭好基础才能一步一步往前进。这里我们需要先为每个`model`编写对应的类型，简单的例子如下

```typescript
type UserModel = {
	namespace: 'user'; //	注意这里使用的字面量类型是很有用的
	state: {
		name: string;
		age: string;
	};
	effects: {
		updateName: Effect;
	};
	reducers: {
		updateAge: Reducer;
	};
};
```

## 实战开始

问题回顾：我们已经准备好了一个`model`，这时我们要对状态进行管理则必须通过`dispatch()`,而该方法的使用方式是代码提示不友好的，简单更新一个`name`需要这样写：`dispatch({type: 'user/updateName',payload:{...} })`,这个`type`完全就是硬编码进去的，使用起来极其不舒服。

我们提前定义好的`Model`的类型就可以发挥作用了，想一下，`type`中对应的方法我们早在`Model`类型中就限定了，即然我们知道有哪些方法可用，那么`TypeScript`魔法就一定有途径帮我们汇集它！

此时我们要做的就是把`effects`和`reducers`汇聚起来，通过`typescript`把方法名统统汇聚成联合类型，使用时不就可以得到对应的代码提示了吗？想想就兴奋！先言少叙，直接上代码！

```typescript
//	1. 把 effects 和 reducers 从 model 中提取出来
type PickEffectsAndReducers<T extends UserModel> = Pick<T, 'effects' | 'reducers'>;
//	2. 再获取一下方法对应的key
type GetKey<T> = { [K in keyof T]: T[K] }[keyof T];
//	此时我们可以得到一个联合类型
type a = GetKey<PickEffectsAndReducers<UserModel>>;
// type a = {
//   updateName: any;
// } | {
//   updateAge: any;
// }
//	这里的联合类型要获取到对应的key处理较难，需要先将 ｜ 转化成 & 即联合变交叉
```

把联合类型变成交叉类型，我没有想到很好的解决办法，所以我们可以换条路子走，一次拿不到，就分开拿再组合。

> review 才发现自己的 ts 水平到底有多垃圾：

```typescript
//	脑子清醒后
//	@version 2021-09-26

//	前置
interface SimpleModelType {
  namespace: unknown;
  state: unknown;
  effects: unknown;
  reducers: unknown;
}

//	此处导出以供项目灵活使用
export type GetEffectsAndReducersType<T extends SimpleModelType> = keyof T['effects'] | keyof T['reducers'];
const getDispatchType = <T extends SimpleModelType>(
  type: GetEffectsAndReducersType<T>,
  namespace?: T['namespace'];,
) => {
  return namespace ? `${namespace}/${type}` : type;
};
```

> 睡醒后回顾代码的时候发现自己还是写得太过于臃肿了，下面这一段是优化后的代码结构，大家可以对比着看，旧代码不会删除，具体的思路是一样的，写得浅显反而方便理解，也能更好的鞭策自己多 review

```typescript
//	新代码
//	@version 2021-09-15

//	前置
		...

//	核心逻辑
type PickDeepVKeyFromT<T, V extends keyof T> = {
  [K in keyof T]: K extends V
    ? keyof {
        [P in keyof T[K]]: P;
      }
    : never;
}[keyof T];

type GetNamespaceType<T extends SimpleModelType> = T['namespace'];
type GetEffectsAndReducersType<T extends SimpleModelType> = PickDeepVKeyFromT<T,'reducers' | 'effects' >;

const getDispatchType = <T extends SimpleModelType>(
  type: GetEffectsAndReducersType<T>,
  namespace?: GetNamespaceType<T>,
) => {
  return namespace ? `${namespace}/${type}` : type;
};
```

**以下为旧代码**：

```typescript
//	从 T,K 中获取方法名并将其交叉
type DeepUnion<T, K> = { [P in keyof T]: T[P] }[keyof T] & { [P in keyof K]: K[P] }[keyof K];
//	获取Model中我们需要的Action
type PickEffectsAndReducers<T extends UserModel> = DeepUnion<Pick<T, 'effects'>, Pick<T, 'reducers'>>;
//	即可获取到由effects 和 reducers 组成的方法名的联合类型了
type ActionKey<T extends UserModel> = keyof PickEffectsAndReducers<T>;
```

到这里我们要完成的工作已经一大半了，接下来我们要找`type`中另一半，即`namespace`

```typescript
//	获取namespace很简单，只需要获取到namespace再提取字面量类型即可
type GetValue<T> = { [K in keyof T]: T[K] }[keyof T];
type GetNamespace<T extends UserModel> = GetValue<Pick<T, 'namespace'>>;
```

这里需要优化一下代码中的`UserModel`，优化方法就是件`UserModel`抽象成一个抽象类，仅用来规范项目中`model`的类型即可

```typescript
//	简单写法：
interface SimpleModelType {
	namespace: unknown;
	state: unknown;
	effects: unknown;
	reducers: unknown;
}

//	获取effects和reducers
type DeepUnion<T, K> = { [P in keyof T]: T[P] }[keyof T] & { [P in keyof K]: K[P] }[keyof K];
type PickEffectsAndReducers<T extends SimpleModelType> = DeepUnion<Pick<T, 'effects'>, Pick<T, 'reducers'>>;
type ActionKey<T extends SimpleModelType> = keyof PickEffectsAndReducers<T>;
//	获取namespace
type GetValue<T> = { [K in keyof T]: T[K] }[keyof T];
type GetNamespace<T extends SimpleModelType> = GetValue<Pick<T, 'namespace'>>;
```

类型写完以后我们就可以随心编写工具函数了，以下为一个我在项目中用于获取`type`的例子

```typescript
/**
 * 提供`dispatch`方法中`type`提示的一个工具函数
 * @param type 通过泛型提供的要提取effect和reducer的model类型
 * @param namespace model的命名空间 - 此处如果model中namespace使用的是类型字面量，则亦会提供代码提示
 * @returns 整合后的type
 */
export const getDispatchType = <T extends SimpleModelType>(type: ActionKey<T>, namespace?: GetNamespace<T>) => {
	return namespace ? `${namespace}/${type}` : type;
};

//	使用方法展示
getDispatchType<UserModel>('$1', '$2'); //	$出现对应的代码提示$
```

需求完成 ✅

## 总结

`Typescript` 真好玩，今天又是快乐摸鱼的一天
