---
title: React Hooks 简单理解
subtitle: 四个 hook 与 dispatcher 
date: 2025-12-18 12:00:00 +0800
tags: 前端
remark: 'React Hooks useState 简单理解，主要介绍 useState 的实现原理，以及类比 useEffect useContext 和 useMemo 的对比，内容比较细化，可以直接看 [#所有 Hook 的执行时机](#所有 Hook 的执行时机)'
---

# React Hooks 简单理解

hooks 一切都从 dispatcher 开始。

```jsx
const [value, setValue] = useState();

function useState(initState){
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initState)
}
```

**dispatcher 是一个全局实例，有三种类型**

- `HooksDispatcherOnMount`：挂载时，用于初始化一个 Fiber 并且初始化其 update queue 队列；

  ```js
  // 在 mountState 中创建 dispatch 函数
  function mountState(initialState) {
    const hook = mountWorkInProgressHook();
    const queue = {
      pending: null,
      dispatch: null,
      // ...
    };
    
    // 初始化状态值
    if (typeof initialState === 'function') {
      hook.memoizedState = initialState();
    } else {
      hook.memoizedState = initialState;
    }
    
    // 关键：绑定当前正在渲染的 Fiber
    const dispatch = (queue.dispatch = dispatchSetState.bind(
      null,
      currentlyRenderingFiber,  // ← 这里的 fiber
      queue
    ));
    
    return [hook.memoizedState, dispatch];
  }
  ```

- `HooksDispatcherOnUpdate`：更新时，调用的是 dispatch 即 `dispatchSetState(fiber, queue, action)`

  ```
  组件 Fiber
    ↓
  memoizedState: Hook1 → Hook2 → Hook3  // Hook 链表
    ↓
  每个 Hook 对象的 queue
    ↓
  queue.pending: Update1 → Update2 → Update3 → 回到 Update1 // 用于合并 setState 更新
  ```

- `HooksDispatcherOnRerender`：在 render 过程中，收集一些 setState 的操作，这时候要使用合并处理而不是像 updateDispatcher 一样触发调度。可以提升性能，防止反复触发重新渲染导致嵌套循环。

完成 update 对象的初始化，并合并更新操作到队列后，在 Fiber 上就挂载上了组件 Hook 和每个 Hook 中的更新队列了，交付给调度器执行任务：

```js
// 实际执行
dispatchSetState(fiber, queue, action);
  ↓
// 内部找到根节点
const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
  ↓
// 调度更新
scheduleUpdateOnFiber(root, fiber, lane);  // ← 传入同一个 fiber
```

`scheduleUpdateOnFiber(root, fiber, lane)` 这里只是一个派发任务的入口，并没有执行任何操作，只是等待调度执行。

- root，React 的应用根节点；向上找根节点的时候，会从 Fiber 开始往父节点打上 `parent.childLane` 代表子树更新；
- fiber，当前触发更新的 Fiber 和 dispatcher 中的为同一个；用于后续调度过程中的使用，可以先不关注
- lane，优先级先忽略；

调度是轻量的：`scheduleUpdateOnFiber`只是安排工作，不立即执行，特点为：多个 `setState`的更新会进入同一个队列无论调度多少次，在批处理中只执行一次渲染。

**React 18 改进，以下所有场景都自动批处理，简单理解就是 scheduleUpdateOnFiber 结束了进入下一个阶段**

1. 同步执行栈清空 - React 事件处理器结束
2. 微任务边界 - React 18 中`Promise、queueMicrotask`
3. 宏任务边界 - `setTimeout、setInterval、requestAnimationFrame`
4. 强制同步 - `flushSync` 调用
5. 渲染阶段开始 - 开始渲染前会先刷新所有待处理更新
6. `LayoutEffect` 执行 - 进入`commit` 阶段时

**后续调度时，从 Root 开始深度遍历子树，已经知道了哪些子树发生了变化，直接就完成了剪枝。**

现在介绍一下 Fiber 在这里的作用：

1. 中断当前渲染：如果正在渲染的树中包含这个 fiber，可能需要重新开始
2. **优先级比较：比较新更新与当前渲染的优先级**
3. 开发工具：显示哪个组件触发了更新
4. 并发模式：决定是否应该中断当前任务

---

> 以下章节描述 useEffect useContext 和 useMemo 的对比，内容比较细化，可以直接看 <a href="#所有 Hook 的执行时机">所有 Hook 的执行时机</a>

---

## 类比一下 `useEffect`

核心都是 dispatcher 调用的 `effectImpl`，分为两个阶段，挂载和更新

```js
const HooksDispatcherOnMount = {
  useEffect: mountEffect,  // 挂载时设置 effect
};

const HooksDispatcherOnUpdate = {
  useEffect: updateEffect,  // 更新时比较依赖
};

const HooksDispatcherOnRerender = {
  useEffect: updateEffect,  // 重渲染时同样逻辑
};
```

挂载阶段的原理，初始化副作用，标记副作用，并把副作用链存储的到 Fiber 上

```js
function mountEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  return mountEffectImpl(
    UpdateEffect | PassiveEffect,  // 副作用标记
    HookPassive,                   // Hook 类型标记
    create,
    deps,
  );
}

function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  
  // 标记当前 Fiber 有副作用
  currentlyRenderingFiber.flags |= fiberFlags;
  
  // 创建 effect 对象
  const effect = {
    tag: hookFlags,        // 标记是 useEffect 还是 useLayoutEffect
    create,                // 用户传入的函数
    destroy: undefined,    // 清理函数（create 的返回值）
    deps: nextDeps,        // 依赖数组
    next: null,            // 链表指针
  };
  
  // 将 effect 存储在 Hook 的 memoizedState
  hook.memoizedState = effect;
  
  // 将 effect 添加到 Fiber 的 updateQueue
  pushEffect(currentlyRenderingFiber, effect);
}
```

更新阶段的原理，判断依赖是否发生了变化，通过 HookHasEffect 标识，无论是否需要执行都继续放在队列中

```js
function updateEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  return updateEffectImpl(
    UpdateEffect | PassiveEffect,
    HookPassive,
    create,
    deps,
  );
}

function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let effect = hook.memoizedState as Effect;
  let destroy = undefined;
  
  if (effect !== null) {
    destroy = effect.destroy;
    
    if (nextDeps !== null) {
      const prevDeps = effect.deps;
      
      // 比较依赖是否变化
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // 依赖没变，创建一个没有 HookHasEffect 标记的 effect
        hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps);
        return;
      }
    }
  }
  
  // 依赖变化，标记需要执行
  currentlyRenderingFiber.flags |= fiberFlags;
  
  // 创建新的 effect，标记为需要执行
  hook.memoizedState = pushEffect(
    hookFlags | HookHasEffect,  // 添加 HookHasEffect 标记
    create,
    destroy,
    nextDeps
  );
}
```

涉及到 Fiber 上的 `updateQueue` 字段，用于存储所有的 effect

```js
// Fiber 节点结构（简化版）
interface Fiber {
  // updateQueue: 副作用队列
  updateQueue: null | {
    lastEffect: Effect | null;   // 指向环形链表的尾部
  };
  flags: Flags;                  // 副作用标记
}


// effect 结构
interface Effect {
  tag: number;         // 标记：HookPassive(useEffect) 或 HookLayout(useLayoutEffect)
  create: () => (() => void) | void;  // 用户传入的函数
  destroy: (() => void) | void;       // 清理函数
  deps: Array<any> | null;  // 依赖数组
  next: Effect | null;      // 指向下一个 effect
}

// updateQueue 存储 effect 的环形链表
fiber.updateQueue = {
  lastEffect: effect3  // 指向环形链表的尾部
};

// 环形链表结构：
// effect1 → effect2 → effect3 → 回到 effect1
// lastEffect 指向 effect3
```

**副作用标记大全**

- Fiber 上的 flags 标记：用于标记整个组件，如 Placement、Update、CallBack、Didcapture、Passive 等等，表示插入、更新、处理回调、捕捉错误、标记有 `useEffect` ，副作用标记只是一个子集而已。
- Hook 上的 effectTag 标记，用于表示单个 effect 的类型的：
  - export const NoFlags = 0b000;     // 000
  - export const HasEffect = 0b001;   // 001 需要执行副作用
  - export const Layout = 0b010;      // 010 useLayoutEffect
  - export const Passive = 0b100;     // 100 useEffect

通过这些标记，可以知道 Fiber 上是否有副作用，以及这些副作用是否需要执行，是同步执行还是调度执行

**`useEffect` 和 `useLayoutEffect` 对比**

| 方面                | `useEffect`       | `useLayoutEffect`        |
| :------------------ | :---------------- | :----------------------- |
| **Dispatcher 标记** | `HookPassive`     | `HookLayout`             |
| **执行时机**        | 浏览器绘制后      | DOM 更新后，浏览器绘制前 |
| **Fiber 标记**      | `PassiveEffect`   | `UpdateEffect`           |
| **调度方式**        | 由 Scheduler 调度 | 同步执行                 |

```js
function commitRoot(root) {
  // 1. 处理 DOM 更新
  commitMutationEffects(root);
  
  // 2. 执行 Layout Effects（同步）
  commitLayoutEffects(root);
  
  // 3. 调度 Passive Effects（异步）
  scheduleCallback(NormalPriority, () => {
    flushPassiveEffects();
  });
}

function flushPassiveEffects() {
  // 遍历 effect 链表
  let effect = fiber.updateQueue?.lastEffect;
  if (effect) {
    const firstEffect = effect.next;
    let current = firstEffect;
    
    do {
      if (current.tag & HasEffect) {
        // 执行 effect（只有标记了 HasEffect 的 effect 才会执行）
        const destroy = current.create();
        current.destroy = destroy;
      }
      current = current.next;
    } while (current !== firstEffect);
  }
}
```

---

## 类比一下 `useContext`

核心都是在任何三个阶段都是用 dispatcher 调用的 `readContext`

```js
// useContext 也有三个对应的实现
const HooksDispatcherOnMount = {
  useContext: readContext,  // 挂载时订阅
};

const HooksDispatcherOnUpdate = {
  useContext: readContext,  // 更新时读取
};

const HooksDispatcherOnRerender = {
  useContext: readContext,  // 重新渲染时读取
};

function useContext<T>(Context: ReactContext<T>): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useContext(Context);
  // 实际都是调用 readContext
}
```

`readContext`：不维护队列，Provider 更新直接触发消费者重新渲染

```js
function readContext<T>(Context: ReactContext<T>): T {
  // 1. 获取当前渲染的 Fiber
  const fiber = currentlyRenderingFiber;
  
  // 2. 创建 ContextItem 对象
  const contextItem = {
    context: Context,
    memoizedValue: Context._currentValue,
    next: null,
  };
  
  // 3. 将 ContextItem 添加到当前 Fiber 的 dependencies 链表
  // 注意：订阅关系存储在 Fiber 上，而不是 Context 对象上
  if (fiber !== null) {
    if (fiber.dependencies === null) {
      fiber.dependencies = {
        lanes: NoLanes,
        firstContext: contextItem,
      };
    } else {
      // 添加到依赖链表的开头
      contextItem.next = fiber.dependencies.firstContext;
      fiber.dependencies.firstContext = contextItem;
    }
  }
  
  // 4. 返回当前 Context 值
  return Context._currentValue;
}
```

| 方面         | `useState`                         | `useContext`                                                |
| :----------- | :--------------------------------- | :---------------------------------------------------------- |
| **状态存储** | 在 Hook 的 `memoizedState`中       | 在 Context 对象的 `_currentValue`中                         |
| **更新触发** | 通过 `setState`函数                | 通过 `Context.Provider`的 value 改变                        |
| **订阅机制** | 不涉及订阅，直接更新               | 组件订阅 Context 变化                                       |
| **更新队列** | 每个 Hook 有自己的 `queue.pending` | 不维护队列，Provider 更新直接触发消费者重新渲染             |
| **性能优化** | 通过 `childLanes`跳过子树          | Context 变化时，所有消费者都会重新渲染（除非用 `memo`包裹） |

**具体实现的数据结构为**

```ts
// Context 对象结构（简化版）
interface ReactContext<T> {
  _currentValue: any,         // 当前值（由最近的 Provider 设置）
  // 注意：React 18 中不再维护全局消费者链表
  // 订阅关系通过 Fiber.dependencies 来追踪
}

// Context 依赖项结构
interface ContextItem {
  context: ReactContext<any>;  // Context 对象
  memoizedValue: any;          // 当前值
  next: ContextItem | null;    // 下一个 ContextItem
}

// 1. 每个使用 useContext 的组件 Fiber
interface Fiber = {
  dependencies: {
    firstContext: ContextItem // ContextItem1 → ContextItem2 → ... → null
  }
}

// Context 示例：一个组件依赖两个 Context
fiber.dependencies = {
  lanes: 0,
  firstContext: {
    context: ThemeContext,      // 第一个 Context
    memoizedValue: 'dark',
    next: {
      context: UserContext,     // 第二个 Context
      memoizedValue: { name: 'John' },
      next: null
    }
  }
};
```

**梳理出来的订阅关系为**

```
组件调用 useContext(MyContext)
    ↓
创建 ContextItem 添加到 ComponentFiber.dependencies
    ↓
组件 Fiber 通过 dependencies.firstContext 链表记录所有依赖的 Context
    ↓
组件知道自己依赖了哪些 Context
```

**Provider 的更新过程为**

```jsx
<MyContext.Provider value={newValue}>
    ↓
更新 MyContext._currentValue = newValue
    ↓
在 Provider 更新时，React 会遍历其子树中的所有 Fiber
    ↓
对每个 Fiber，检查其 dependencies.firstContext 链表：
    1. 是否包含当前 Context 的 ContextItem
    2. 检查是否在当前 Provider 的子树中
    3. 检查是否有更近的 Provider（向上查找）
    4. 如果应该响应这个更新：
        - 标记 consumerFiber.lanes
        - 向上标记 parent.childLanes
    ↓
调度器看到有标记的 Fiber
    ↓
安排重新渲染
```

在这里 `Context` 实例是全局单例，但订阅关系是通过每个 Fiber 的 `dependencies` 来维护的，而不是在 Context 对象上维护全局消费者链表。`Provider` 不是全局单例：

```tsx
// 示例：同一个 Context 可以有多个 Provider
<MyContext.Provider value="value1">  {/* Provider 实例 1 */}
  <ComponentA />
  <MyContext.Provider value="value2">  {/* Provider 实例 2 */}
    <ComponentB />
  </MyContext.Provider>
</MyContext.Provider>
```

判断一个 Provider 的子树的算法有以下过程：向上遍历检查 Provider 链条，检查消费者 Consumer Fiber ，当前更新的 Provider Fiber 以及 Context 对象。

- **最近优先**：消费者总是使用**最近的**同类型 Provider
- **向上查找**：从消费者向上找，不是从 Provider 向下
- **精确匹配**：只影响真正依赖当前 Provider 的消费

总结以上，Context 是一个全局实例，但订阅关系分散存储在各个消费者 Fiber 的 `dependencies` 中。当这个 Context 的某个 Provider 更新时，React 会遍历该 Provider 子树中的所有 Fiber，检查每个 Fiber 的 `dependencies.firstContext` 链表，找到所有订阅了该 Context 的消费者 Fiber，并检查它们是否应该响应这个特定的 Provider 更新。如果是，就给这个 Fiber 打上更新标记。


---

## 类比一下 `useMemo`

**`useMemo`的三种 Dispatcher**，底层调用的是 dispatcher 的 `mountMemo` 以及 `updateMemo`

```js
const HooksDispatcherOnMount = {
  useMemo: mountMemo,  // 挂载时计算并缓存
};

const HooksDispatcherOnUpdate = {
  useMemo: updateMemo,  // 更新时比较依赖
};

const HooksDispatcherOnRerender = {
  useMemo: updateMemo,  // 重新渲染时同样逻辑
};
```

核心方法就是比较依赖判断是否要返回缓存值

```js
// mountMemo: 首次渲染
function mountMemo<T>(
  nextCreate: () => T,
  deps: Array<mixed> | void | null,
): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  
  // 计算初始值
  const nextValue = nextCreate();
  
  // 存储值和依赖
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

// updateMemo: 更新时
function updateMemo<T>(
  nextCreate: () => T,
  deps: Array<mixed> | void | null,
): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;
  
  if (prevState !== null) {
    if (nextDeps !== null) {
      //	hook.memoizedState = [nextValue, nextDeps];
      const prevDeps = prevState[1];
      
      // 比较依赖是否变化
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // 依赖没变，返回缓存的值
        return prevState[0];
      }
    }
  }
  
  // 依赖变化，重新计算
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}
```

| 方面             | `useState`                 | `useMemo`                      |
| :--------------- | :------------------------- | :----------------------------- |
| **主要目的**     | 存储和更新状态             | 缓存计算结果                   |
| **触发重新计算** | 通过 `setState`显式触发    | 依赖数组变化时自动触发         |
| **数据结构**     | 存储值和更新队列           | 存储 [value, deps] 数组        |
| **副作用**       | 会触发组件重新渲染         | 不会触发渲染，但会影响渲染结果 |
| **队列机制**     | 有 `queue.pending`更新队列 | 无队列，直接比较依赖           |

---

##  所有 Hook 的执行时机

所有更新触发都可以追踪到状态的改变，这些状态通过不同路径传播最终影响组件的 props 等的改变，React 是声明式的，你需要声明 "当状态是什么的时候，UI 长什么样子" ，最终这些更新触发都会导致 UI 的改变。

| 更新表现         | 实际源头            | 触发方式                |
| ---------------- | ------------------- | ----------------------- |
| 组件重新渲染     | 组件自身 state 改变 | `setState()`            |
| Props 改变       | 父组件 state 改变   | 父组件 `setState()`     |
| Context 值改变   | 某个组件 state 改变 | 那个组件的 `setState()` |
| 状态管理仓库改变 | store 内部状态改变  | `store.dispatch()`      |
| URL 改变         | 路由状态改变        | `history.push()`        |

基于这些认识，可以把 `useState、useEffect、useContext、useMemo` 串联起来了

```jsx
Fiber 节点
├── memoizedState: Hook链表
│   ├── Hook1 (useState): { queue, memoizedState, ... }
│   ├── Hook2 (useMemo): { memoizedState: [value, deps] }
│   └── Hook3 (useMemo): { memoizedState: [value, deps] }
├── dependencies: Context依赖链表
│   └── ContextItem1 → ContextItem2
└── updateQueue: 副作用队列
```

通过一次更新，调度了一次 `scheduleUpdateOnFiber` 执行了各类 hook 的执行，标记出若干需要更新的子树，最终传递给 Root，在 `reconciler` 执行 render 构造双缓存树。
